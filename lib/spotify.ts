import type { SpotifyTrack } from '@/types';

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!;
const SCOPES = 'user-library-read';

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

function storeTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  localStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  localStorage.setItem(
    'spotify_token_expiry',
    String(Date.now() + data.expires_in * 1000)
  );
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
}

export function hasStoredToken(): boolean {
  return !!localStorage.getItem('spotify_access_token');
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

async function fetchPage(
  token: string,
  offset: number,
  limit: number
): Promise<{ items: RawSavedTrack[]; total: number }> {
  const res = await fetch(
    `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
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

  // Fetch remaining pages sequentially to avoid rate-limiting
  let offset = limit;
  while (offset < total) {
    const page = await fetchPage(token, offset, limit);
    tracks.push(...(page.items ?? []).map(mapTrack));
    offset += limit;
  }

  return tracks;
}
