'use client';

import type { Cluster } from '@/types';

interface Props {
  cluster: Cluster;
  memberCount: number;
  isDragOver: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDeleteClick: () => void;
}

export default function ClusterBubble({
  cluster,
  memberCount,
  isDragOver,
  onMouseDown,
  onDeleteClick,
}: Props) {
  const bg = cluster.color + '33'; // 20% opacity
  const border = cluster.color;

  return (
    <div
      className={`cluster-bubble${isDragOver ? ' drag-over' : ''}`}
      style={{
        left: cluster.x,
        top: cluster.y,
        background: bg,
        border: `2px solid ${border}`,
      }}
      onMouseDown={onMouseDown}
    >
      <button
        className="cluster-delete-btn"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
        title="Delete cluster"
      >
        ✕
      </button>
      <span className="cluster-label">{cluster.name}</span>
      {memberCount > 0 && (
        <span className="cluster-count">{memberCount} track{memberCount !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
