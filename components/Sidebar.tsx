'use client';

import type { CanvasTrack, Membership } from '@/types';
import SidebarTrack from './SidebarTrack';

interface Props {
  tracks: CanvasTrack[];
  memberships: Membership[];
  onTrackDragStart: (trackId: string, e: React.MouseEvent) => void;
}

export default function Sidebar({ tracks, memberships, onTrackDragStart }: Props) {
  function clusterCountFor(trackId: string): number {
    return memberships.filter((m) => m.trackId === trackId).length;
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Saved Tracks</span>
        <span className="sidebar-count">{tracks.length}</span>
      </div>
      <div className="sidebar-list">
        {tracks.map((track) => (
          <SidebarTrack
            key={track.id}
            track={track}
            clusterCount={clusterCountFor(track.id)}
            onMouseDown={(e) => onTrackDragStart(track.id, e)}
          />
        ))}
      </div>
    </div>
  );
}
