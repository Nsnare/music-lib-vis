interface CacheEntry {
  userId: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export class SpotifyAuthError extends Error {}

export async function getUserId(token: string): Promise<string> {
  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }

  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new SpotifyAuthError('Invalid or expired Spotify token');
  }
  if (!res.ok) {
    throw new Error(`Spotify /me returned ${res.status}`);
  }

  const data = await res.json();
  const userId: string = data.id;

  cache.set(token, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return userId;
}
