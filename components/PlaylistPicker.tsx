'use client';

import type { SpotifyPlaylist } from '@/lib/spotify';

interface Props {
  playlists: SpotifyPlaylist[];
  onSelect: (playlist: SpotifyPlaylist) => void;
}

export default function PlaylistPicker({ playlists, onSelect }: Props) {
  return (
    <div className="playlist-picker">
      <div className="playlist-picker-header">
        <h2>Choose a playlist</h2>
        <p>Tracks will be loaded onto the canvas (up to 500 per playlist)</p>
      </div>
      <div className="playlist-grid">
        {playlists.map((p) => (
          <button key={p.id} className="playlist-card" onClick={() => onSelect(p)}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="playlist-art" />
            ) : (
              <div className="playlist-art playlist-art-fallback">
                <MusicIcon />
              </div>
            )}
            <div className="playlist-info">
              <span className="playlist-name">{p.name}</span>
              <span className="playlist-count">{p.trackCount} tracks</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MusicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}
