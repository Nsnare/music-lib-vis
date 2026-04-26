'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  exchangeCode,
  fetchPlaylistTracks,
  fetchUserPlaylists,
  getAccessToken,
  clearTokens,
  hasStoredToken,
  type SpotifyPlaylist,
} from '@/lib/spotify';
import { nanoid } from '@/lib/nanoid';
import type { CanvasTrack, Cluster, Membership } from '@/types';
import LoginScreen from './LoginScreen';
import PlaylistPicker from './PlaylistPicker';
import Sidebar from './Sidebar';
import Canvas from './Canvas';
import AudioPlayer from './AudioPlayer';
import ClusterCreateModal from './ClusterCreateModal';

type AuthState = 'loading' | 'unauthenticated' | 'picking-playlist' | 'loading-tracks' | 'authenticated' | 'error';

interface GhostState {
  trackId: string;
  albumArt: string;
  x: number;
  y: number;
}

export default function AppRoot() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<CanvasTrack[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [sidebarDragTrackId, setSidebarDragTrackId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSaves = useRef<Map<string, { type: 'track' | 'cluster'; data: unknown }>>(new Map());

  // ── Boot: handle OAuth code or load from storage ───────────────────────────

  useEffect(() => {
    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        setAuthState('unauthenticated');
        return;
      }

      if (code) {
        window.history.replaceState({}, '', '/');
        try {
          await exchangeCode(code);
        } catch (e) {
          setBootError(`Auth failed: ${e instanceof Error ? e.message : String(e)}`);
          setAuthState('error');
          return;
        }
      }

      if (!hasStoredToken()) {
        // Covers expired tokens, missing scope version, and missing required scopes.
        // Always clear so the login screen triggers a fresh PKCE flow with show_dialog=true.
        clearTokens();
        setAuthState('unauthenticated');
        return;
      }

      try {
        const accessToken = await getAccessToken();
        setToken(accessToken);
        const userPlaylists = await fetchUserPlaylists(accessToken);
        setPlaylists(userPlaylists);
        setAuthState('picking-playlist');
      } catch (e) {
        setBootError(`Failed to load playlists: ${e instanceof Error ? e.message : String(e)}`);
        setAuthState('error');
      }
    }

    boot();
  }, []);

  async function handlePlaylistSelect(playlist: SpotifyPlaylist) {
    if (!token) return;
    setSelectedPlaylist(playlist);
    setAuthState('loading-tracks');
    try {
      await loadData(token, playlist.id);
      setAuthState('authenticated');
    } catch (e) {
      setBootError(`Failed to load tracks: ${e instanceof Error ? e.message : String(e)}`);
      setAuthState('error');
    }
  }

  async function loadData(accessToken: string, playlistId: string) {
    const [spotifyTracks, layoutRes] = await Promise.all([
      fetchPlaylistTracks(accessToken, playlistId),
      fetch('/api/layout', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);

    const rawLayout = layoutRes.ok ? await layoutRes.json().catch(() => ({})) : {};
    const layout = {
      tracks: rawLayout.tracks ?? [],
      clusters: rawLayout.clusters ?? [],
      memberships: rawLayout.memberships ?? [],
    };
    const positionMap = new Map<string, { x: number; y: number }>(
      layout.tracks.map((t: { id: string; x: number; y: number }) => [t.id, { x: t.x, y: t.y }])
    );

    const merged: CanvasTrack[] = spotifyTracks.map((st, i) => {
      const pos = positionMap.get(st.id);
      return {
        ...st,
        x: pos?.x ?? 120 + (i % 10) * 200,
        y: pos?.y ?? 120 + Math.floor(i / 10) * 140,
      };
    });

    setTracks(merged);
    setClusters(layout.clusters);
    setMemberships(layout.memberships);
  }

  // ── Auto-save helpers ──────────────────────────────────────────────────────

  function scheduleTrackSave(trackId: string, x: number, y: number) {
    const existing = saveTimers.current.get(`track-${trackId}`);
    if (existing) clearTimeout(existing);

    pendingSaves.current.set(`track-${trackId}`, { type: 'track', data: { id: trackId, x, y } });

    const timer = setTimeout(() => {
      flushSave(`track-${trackId}`);
    }, 800);

    saveTimers.current.set(`track-${trackId}`, timer);
  }

  function scheduleClusterSave(clusterId: string, x: number, y: number) {
    const existing = saveTimers.current.get(`cluster-${clusterId}`);
    if (existing) clearTimeout(existing);

    pendingSaves.current.set(`cluster-${clusterId}`, { type: 'cluster', data: { x, y } });

    const timer = setTimeout(() => {
      flushSave(`cluster-${clusterId}`, clusterId);
    }, 800);

    saveTimers.current.set(`cluster-${clusterId}`, timer);
  }

  async function flushSave(key: string, clusterId?: string) {
    const pending = pendingSaves.current.get(key);
    if (!pending || !token) return;

    pendingSaves.current.delete(key);
    saveTimers.current.delete(key);

    if (pending.type === 'track') {
      const d = pending.data as { id: string; x: number; y: number };
      await fetch('/api/tracks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(d),
      }).catch(() => {});
    } else if (pending.type === 'cluster' && clusterId) {
      const d = pending.data as { x: number; y: number };
      await fetch(`/api/clusters/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(d),
      }).catch(() => {});
    }
  }

  // Flush all pending saves on page unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (!token) return;
      for (const [key, pending] of pendingSaves.current.entries()) {
        const clusterId = key.startsWith('cluster-') ? key.slice(8) : undefined;
        if (pending.type === 'track') {
          const d = pending.data as { id: string; x: number; y: number };
          navigator.sendBeacon(
            '/api/tracks',
            new Blob([JSON.stringify({ ...d, _token: token })], { type: 'application/json' })
          );
        } else if (pending.type === 'cluster' && clusterId) {
          navigator.sendBeacon(
            `/api/clusters/${clusterId}`,
            new Blob([JSON.stringify({ ...(pending.data as object), _token: token })], {
              type: 'application/json',
            })
          );
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [token]);

  // ── Canvas event handlers ──────────────────────────────────────────────────

  const handleTrackMove = useCallback(
    (trackId: string, x: number, y: number) => {
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, x, y } : t)));
      scheduleTrackSave(trackId, x, y);
    },
    [token]
  );

  const handleClusterMove = useCallback(
    (clusterId: string, x: number, y: number) => {
      setClusters((prev) => prev.map((c) => (c.id === clusterId ? { ...c, x, y } : c)));
      scheduleClusterSave(clusterId, x, y);
    },
    [token]
  );

  const handleTrackDropOnCluster = useCallback(
    (trackId: string, clusterId: string) => {
      const already = memberships.some((m) => m.trackId === trackId && m.clusterId === clusterId);
      if (already) return;

      setMemberships((prev) => [...prev, { trackId, clusterId }]);

      if (token) {
        fetch('/api/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ trackId, clusterId }),
        }).catch(() => {});
      }
    },
    [memberships, token]
  );

  const handleTrackClick = useCallback(
    (trackId: string) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track?.previewUrl) return;
      setPlayingTrackId((prev) => (prev === trackId ? null : trackId));
    },
    [tracks]
  );

  const handleDeleteCluster = useCallback(
    (clusterId: string) => {
      setClusters((prev) => prev.filter((c) => c.id !== clusterId));
      setMemberships((prev) => prev.filter((m) => m.clusterId !== clusterId));

      if (token) {
        fetch(`/api/clusters/${clusterId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    },
    [token]
  );

  const handleCreateCluster = useCallback(
    (name: string, color: string) => {
      const newCluster: Cluster = { id: nanoid(), name, color, x: 200, y: 200 };
      setClusters((prev) => [...prev, newCluster]);

      if (token) {
        fetch('/api/clusters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(newCluster),
        }).catch(() => {});
      }
    },
    [token]
  );

  // ── Sidebar drag ───────────────────────────────────────────────────────────

  const handleSidebarDragStart = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;

      setSidebarDragTrackId(trackId);
      setGhost({ trackId, albumArt: track.albumArt, x: e.clientX - 24, y: e.clientY - 24 });

      function handleMove(ev: MouseEvent) {
        setGhost((g) => g && { ...g, x: ev.clientX - 24, y: ev.clientY - 24 });
      }

      function handleUp() {
        setGhost(null);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      }

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [tracks]
  );

  const handleSidebarDrop = useCallback(
    (trackId: string, x: number, y: number) => {
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, x, y } : t)));
      scheduleTrackSave(trackId, x, y);
      setSidebarDragTrackId(null);
    },
    [token]
  );

  const handleSidebarDragEnd = useCallback(() => {
    setSidebarDragTrackId(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return <div className="loading-screen">Loading…</div>;
  }

  if (authState === 'picking-playlist') {
    return (
      <PlaylistPicker
        playlists={playlists}
        onSelect={handlePlaylistSelect}
        onReauthorize={() => { clearTokens(); setAuthState('unauthenticated'); }}
      />
    );
  }

  if (authState === 'loading-tracks') {
    return (
      <div className="loading-screen">
        Loading {selectedPlaylist?.name ?? 'playlist'}…
      </div>
    );
  }

  if (authState === 'error') {
    const canRetryPlaylist = !!playlists.length;
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <span style={{ color: '#e74c3c', maxWidth: 400, textAlign: 'center' }}>{bootError}</span>
        {canRetryPlaylist ? (
          <button
            className="login-btn"
            onClick={() => { setBootError(null); setAuthState('picking-playlist'); }}
          >
            Choose a different playlist
          </button>
        ) : (
          <button
            className="login-btn"
            onClick={() => { clearTokens(); setAuthState('unauthenticated'); setBootError(null); }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        tracks={tracks}
        memberships={memberships}
        onTrackDragStart={handleSidebarDragStart}
      />

      <Canvas
        tracks={tracks}
        clusters={clusters}
        memberships={memberships}
        playingTrackId={playingTrackId}
        onTrackMove={handleTrackMove}
        onClusterMove={handleClusterMove}
        onTrackDropOnCluster={handleTrackDropOnCluster}
        onTrackClick={handleTrackClick}
        onDeleteCluster={handleDeleteCluster}
        onNewCluster={() => setShowClusterModal(true)}
        sidebarDragTrackId={sidebarDragTrackId}
        onSidebarDrop={handleSidebarDrop}
        onSidebarDragEnd={handleSidebarDragEnd}
      />

      <AudioPlayer trackId={playingTrackId} tracks={tracks} />

      {showClusterModal && (
        <ClusterCreateModal
          onConfirm={handleCreateCluster}
          onClose={() => setShowClusterModal(false)}
        />
      )}

      {ghost && (
        <div
          className="drag-ghost"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.albumArt ? (
            <img src={ghost.albumArt} alt="" draggable={false} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#222' }} />
          )}
        </div>
      )}
    </div>
  );
}
