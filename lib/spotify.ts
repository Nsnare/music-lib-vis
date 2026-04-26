import type { SpotifyTrack } from '@/types';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!;
const SCOPES = 'user-library-read playlist-read-private playlist-read-collaborative';
const SCOPE_VERSION = 'v2'; // bump when scopes change to force re-auth

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function generateVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return base64url(bytes.buffer);
}

// ── Auth flow ─────────────────────────────────────────────────────────────────

export async function initiateLogin(): Promise<void> {
  const verifier = generateVerifier();
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    show_dialog: 'true', // always show consent screen so new scopes are explicitly granted
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const verifier = localStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Missing PKCE verifier — please try logging in again');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

  const data = await res.json();
  storeTokens(data);
  localStorage.removeItem('pkce_verifier');
}

const REQUIRED_SCOPES = ['user-library-read', 'playlist-read-private', 'playlist-read-collaborative'];

function storeTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}): void {
  localStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  localStorage.setItem(
    'spotify_token_expiry',
    String(Date.now() + data.expires_in * 1000)
  );
  localStorage.setItem('spotify_scope_version', SCOPE_VERSION);
  if (data.scope) {
    localStorage.setItem('spotify_granted_scopes', data.scope);
  }
}

function hasRequiredScopes(): boolean {
  const granted = localStorage.getItem('spotify_granted_scopes') ?? '';
  const grantedSet = new Set(granted.split(' '));
  return REQUIRED_SCOPES.every((s) => grantedSet.has(s));
}

async function refreshToken(): Promise<string> {
  const refresh = localStorage.getItem('spotify_refresh_token');
  if (!refresh) throw new Error('No refresh token');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: CLIENT_ID,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const token = localStorage.getItem('spotify_access_token');
  const expiry = Number(localStorage.getItem('spotify_token_expiry') ?? '0');

  if (!token) throw new Error('Not authenticated');

  if (Date.now() > expiry - 60_000) {
    return refreshToken();
  }

  return token;
}

export function clearTokens(): void {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
  localStorage.removeItem('spotify_scope_version');
  localStorage.removeItem('spotify_granted_scopes');
}

export function hasStoredToken(): boolean {
  return (
    !!localStorage.getItem('spotify_access_token') &&
    localStorage.getItem('spotify_scope_version') === SCOPE_VERSION &&
    hasRequiredScopes()
  );
}

// ── Current user ─────────────────────────────────────────────────────────────

export async function fetchCurrentUserId(token: string): Promise<string> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify /me error ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

// ── Spotify API ───────────────────────────────────────────────────────────────

interface RawSavedTrack {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    preview_url: string | null;
  };
}

function mapTrack(item: RawSavedTrack): SpotifyTrack {
  const images = item.track.album.images;
  const albumArt = images[1]?.url ?? images[0]?.url ?? '';
  return {
    id: item.track.id,
    title: item.track.name,
    artist: item.track.artists[0]?.name ?? 'Unknown',
    albumArt,
    previewUrl: item.track.preview_url,
  };
}

const TRACK_CAP = 500; // canvas gets unwieldy beyond this
const PAGE_DELAY_MS = 200; // pause between pages to stay under rate limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(
  token: string,
  offset: number,
  limit: number
): Promise<{ items: RawSavedTrack[]; total: number }> {
  const res = await fetch(
    `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '5');
    await sleep(retryAfter * 1000);
    return fetchPage(token, offset, limit); // one retry after waiting
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Spotify API error ${res.status}: ${err?.error?.message ?? res.statusText}`
    );
  }
  return res.json();
}

export async function fetchAllSavedTracks(token: string): Promise<SpotifyTrack[]> {
  const limit = 50;
  const first = await fetchPage(token, 0, limit);
  const total = Math.min(first.total ?? 0, TRACK_CAP);
  const tracks: SpotifyTrack[] = (first.items ?? []).map(mapTrack);

  let offset = limit;
  while (offset < total) {
    await sleep(PAGE_DELAY_MS);
    const page = await fetchPage(token, offset, limit);
    tracks.push(...(page.items ?? []).map(mapTrack));
    offset += limit;
  }

  return tracks;
}

// ── Playlists ─────────────────────────────────────────────────────────────────

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string;
  trackCount: number;
}

export async function fetchUserPlaylists(
  token: string,
  currentUserId: string
): Promise<SpotifyPlaylist[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const limit = 50;
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/me/playlists?limit=${limit}`;

  while (url) {
    const res: Response = await fetch(url, { headers });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '5');
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
    const data = await res.json();
    for (const p of data.items ?? []) {
      if (!p.id) continue;
      // Only include playlists we can actually read tracks from:
      // - Playlists owned by the current user (public or private)
      // - Public playlists owned by others
      // - Collaborative playlists (readable via playlist-read-collaborative)
      // Excludes: Spotify-owned playlists + private playlists owned by others
      const ownedByMe = p.owner?.id === currentUserId;
      const isPublic = p.public === true;
      const isCollaborative = p.collaborative === true;
      if (!ownedByMe && !isPublic && !isCollaborative) continue;
      if (p.owner?.id === 'spotify') continue;
      playlists.push({
        id: p.id,
        name: p.name,
        imageUrl: p.images?.[0]?.url ?? '',
        trackCount: p.tracks?.total ?? 0,
      });
    }
    url = data.next ?? null;
    if (url) await sleep(PAGE_DELAY_MS);
  }

  return playlists;
}

export async function fetchPlaylistTracks(
  token: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const limit = 50;
  const tracks: SpotifyTrack[] = [];
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`;

  while (url && tracks.length < TRACK_CAP) {
    const res: Response = await fetch(url, { headers });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '5');
      await sleep(retryAfter * 1000);
      continue;
    }
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const granted = typeof localStorage !== 'undefined'
        ? localStorage.getItem('spotify_granted_scopes') ?? '(none stored)'
        : '(not in browser)';
      throw new Error(
        `Spotify 403 on ${url}\nBody: ${JSON.stringify(body)}\nGranted scopes: ${granted}`
      );
    }
    if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
    const data = await res.json();
    for (const item of data.items ?? []) {
      if (item.track?.id) tracks.push(mapTrack(item));
    }
    url = data.next ?? null;
    if (url) await sleep(PAGE_DELAY_MS);
  }

  return tracks;
}
