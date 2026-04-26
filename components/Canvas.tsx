'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasTrack, Cluster, Membership } from '@/types';
import ClusterBubble from './ClusterBubble';
import TrackNode from './TrackNode';

const CLUSTER_RADIUS = 90; // half of 180px
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

type DragState =
  | { type: 'track'; trackId: string; offsetX: number; offsetY: number }
  | { type: 'cluster'; clusterId: string; offsetX: number; offsetY: number }
  | null;

interface Props {
  tracks: CanvasTrack[];
  clusters: Cluster[];
  memberships: Membership[];
  playingTrackId: string | null;
  onTrackMove: (trackId: string, x: number, y: number) => void;
  onClusterMove: (clusterId: string, x: number, y: number) => void;
  onTrackDropOnCluster: (trackId: string, clusterId: string) => void;
  onTrackClick: (trackId: string) => void;
  onDeleteCluster: (clusterId: string) => void;
  onNewCluster: () => void;
  // Sidebar drag integration
  sidebarDragTrackId: string | null;
  onSidebarDrop: (trackId: string, x: number, y: number) => void;
  onSidebarDragEnd: () => void;
}

function isOverCluster(mx: number, my: number, cluster: Cluster): boolean {
  const cx = cluster.x + CLUSTER_RADIUS;
  const cy = cluster.y + CLUSTER_RADIUS;
  const dx = mx - cx;
  const dy = my - cy;
  return Math.sqrt(dx * dx + dy * dy) <= CLUSTER_RADIUS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function Canvas({
  tracks,
  clusters,
  memberships,
  playingTrackId,
  onTrackMove,
  onClusterMove,
  onTrackDropOnCluster,
  onTrackClick,
  onDeleteCluster,
  onNewCluster,
  sidebarDragTrackId,
  onSidebarDrop,
  onSidebarDragEnd,
}: Props) {
  const dragState = useRef<DragState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localTracks, setLocalTracks] = useState(tracks);
  const [localClusters, setLocalClusters] = useState(clusters);
  const [dragOverClusterId, setDragOverClusterId] = useState<string | null>(null);

  // Keep local state in sync when parent updates (initial load / DB sync)
  useEffect(() => { setLocalTracks(tracks); }, [tracks]);
  useEffect(() => { setLocalClusters(clusters); }, [clusters]);

  const memberCountForCluster = useCallback(
    (clusterId: string) => memberships.filter((m) => m.clusterId === clusterId).length,
    [memberships]
  );

  const clusterColorForTrack = useCallback(
    (trackId: string): string | null => {
      const m = memberships.find((m) => m.trackId === trackId);
      if (!m) return null;
      return clusters.find((c) => c.id === m.clusterId)?.color ?? null;
    },
    [memberships, clusters]
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleTrackMouseDown = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const track = localTracks.find((t) => t.id === trackId);
      if (!track) return;
      const scroll = scrollRef.current;
      const scrollLeft = scroll?.scrollLeft ?? 0;
      const scrollTop = scroll?.scrollTop ?? 0;
      const canvasRect = scroll?.getBoundingClientRect();
      const canvasX = e.clientX - (canvasRect?.left ?? 0) + scrollLeft;
      const canvasY = e.clientY - (canvasRect?.top ?? 0) + scrollTop;
      dragState.current = {
        type: 'track',
        trackId,
        offsetX: canvasX - track.x,
        offsetY: canvasY - track.y,
      };
    },
    [localTracks]
  );

  const handleClusterMouseDown = useCallback(
    (clusterId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const cluster = localClusters.find((c) => c.id === clusterId);
      if (!cluster) return;
      const scroll = scrollRef.current;
      const scrollLeft = scroll?.scrollLeft ?? 0;
      const scrollTop = scroll?.scrollTop ?? 0;
      const canvasRect = scroll?.getBoundingClientRect();
      const canvasX = e.clientX - (canvasRect?.left ?? 0) + scrollLeft;
      const canvasY = e.clientY - (canvasRect?.top ?? 0) + scrollTop;
      dragState.current = {
        type: 'cluster',
        clusterId,
        offsetX: canvasX - cluster.x,
        offsetY: canvasY - cluster.y,
      };
    },
    [localClusters]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;

      const scroll = scrollRef.current;
      const scrollLeft = scroll?.scrollLeft ?? 0;
      const scrollTop = scroll?.scrollTop ?? 0;
      const canvasRect = scroll?.getBoundingClientRect();
      const canvasX = e.clientX - (canvasRect?.left ?? 0) + scrollLeft;
      const canvasY = e.clientY - (canvasRect?.top ?? 0) + scrollTop;

      if (ds.type === 'track') {
        const x = clamp(canvasX - ds.offsetX, 0, CANVAS_WIDTH - 64);
        const y = clamp(canvasY - ds.offsetY, 0, CANVAS_HEIGHT - 64);
        setLocalTracks((prev) =>
          prev.map((t) => (t.id === ds.trackId ? { ...t, x, y } : t))
        );
        // Highlight cluster under cursor
        const hoveredCluster = localClusters.find((c) => isOverCluster(canvasX, canvasY, c));
        setDragOverClusterId(hoveredCluster?.id ?? null);
      }

      if (ds.type === 'cluster') {
        const x = clamp(canvasX - ds.offsetX, 0, CANVAS_WIDTH - 180);
        const y = clamp(canvasY - ds.offsetY, 0, CANVAS_HEIGHT - 180);
        setLocalClusters((prev) =>
          prev.map((c) => (c.id === ds.clusterId ? { ...c, x, y } : c))
        );
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;

      const scroll = scrollRef.current;
      const scrollLeft = scroll?.scrollLeft ?? 0;
      const scrollTop = scroll?.scrollTop ?? 0;
      const canvasRect = scroll?.getBoundingClientRect();
      const canvasX = e.clientX - (canvasRect?.left ?? 0) + scrollLeft;
      const canvasY = e.clientY - (canvasRect?.top ?? 0) + scrollTop;

      if (ds.type === 'track') {
        const track = localTracks.find((t) => t.id === ds.trackId);
        if (track) {
          const overlappedCluster = localClusters.find((c) => isOverCluster(canvasX, canvasY, c));
          if (overlappedCluster) {
            onTrackDropOnCluster(ds.trackId, overlappedCluster.id);
          }
          onTrackMove(ds.trackId, track.x, track.y);
        }
        setDragOverClusterId(null);
      }

      if (ds.type === 'cluster') {
        const cluster = localClusters.find((c) => c.id === ds.clusterId);
        if (cluster) onClusterMove(ds.clusterId, cluster.x, cluster.y);
      }

      dragState.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [localTracks, localClusters, onTrackMove, onClusterMove, onTrackDropOnCluster]);

  // ── Sidebar drag drop ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!sidebarDragTrackId) return;

    const handleMouseUp = (e: MouseEvent) => {
      const scroll = scrollRef.current;
      const canvasRect = scroll?.getBoundingClientRect();
      if (!canvasRect) { onSidebarDragEnd(); return; }

      const isInsideCanvas =
        e.clientX >= canvasRect.left &&
        e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top &&
        e.clientY <= canvasRect.bottom;

      if (isInsideCanvas) {
        const scrollLeft = scroll?.scrollLeft ?? 0;
        const scrollTop = scroll?.scrollTop ?? 0;
        const x = clamp(e.clientX - canvasRect.left + scrollLeft - 32, 0, CANVAS_WIDTH - 64);
        const y = clamp(e.clientY - canvasRect.top + scrollTop - 32, 0, CANVAS_HEIGHT - 64);
        onSidebarDrop(sidebarDragTrackId, x, y);
      } else {
        onSidebarDragEnd();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [sidebarDragTrackId, onSidebarDrop, onSidebarDragEnd]);

  return (
    <>
      <div className="canvas-scroll" ref={scrollRef}>
        <div className="canvas-field">
          {localClusters.map((cluster) => (
            <ClusterBubble
              key={cluster.id}
              cluster={cluster}
              memberCount={memberCountForCluster(cluster.id)}
              isDragOver={dragOverClusterId === cluster.id}
              onMouseDown={(e) => handleClusterMouseDown(cluster.id, e)}
              onDeleteClick={() => onDeleteCluster(cluster.id)}
            />
          ))}
          {localTracks.map((track) => (
            <TrackNode
              key={track.id}
              track={track}
              isPlaying={playingTrackId === track.id}
              clusterColor={clusterColorForTrack(track.id)}
              onMouseDown={(e) => handleTrackMouseDown(track.id, e)}
              onClick={() => onTrackClick(track.id)}
            />
          ))}
        </div>
      </div>

      <button className="canvas-new-cluster-btn" onClick={onNewCluster}>
        <span>+</span> New Cluster
      </button>
    </>
  );
}
