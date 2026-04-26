'use client';

import type { CanvasTrack } from '@/types';

interface Props {
  track: CanvasTrack;
  isPlaying: boolean;
  clusterColor: string | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export default function TrackNode({
  track,
  isPlaying,
  clusterColor,
  onMouseDown,
  onClick,
}: Props) {
  const hasPreview = !!track.previewUrl;

  return (
    <div
      className={`track-node${isPlaying ? ' is-playing' : ''}`}
      style={{
        left: track.x,
        top: track.y,
        borderColor: clusterColor ?? 'transparent',
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title={`${track.title} — ${track.artist}`}
    >
      {track.albumArt ? (
        <img src={track.albumArt} alt={track.title} draggable={false} />
      ) : (
        <div className="track-art-fallback">
          <MusicIcon />
        </div>
      )}

      <div className="track-title-overlay">{track.title}</div>

      {!hasPreview && (
        <span className="track-no-preview" title="No preview available">
          <MutedIcon />
        </span>
      )}

      {isPlaying && (
        <div className="track-playing-icon">
          <PauseIcon />
        </div>
      )}
    </div>
  );
}

function MusicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
