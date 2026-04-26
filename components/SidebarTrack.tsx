'use client';

import type { CanvasTrack } from '@/types';

interface Props {
  track: CanvasTrack;
  clusterCount: number;
  onMouseDown: (e: React.MouseEvent) => void;
}

export default function SidebarTrack({ track, clusterCount, onMouseDown }: Props) {
  return (
    <div className="sidebar-track" onMouseDown={onMouseDown}>
      {track.albumArt ? (
        <img className="sidebar-art" src={track.albumArt} alt={track.title} draggable={false} />
      ) : (
        <div className="sidebar-art-fallback">
          <MusicIcon />
        </div>
      )}
      <div className="sidebar-info">
        <div className="sidebar-track-title">{track.title}</div>
        <div className="sidebar-track-artist">{track.artist}</div>
      </div>
      {clusterCount > 0 && (
        <span className="sidebar-badge">{clusterCount}</span>
      )}
    </div>
  );
}

function MusicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}
