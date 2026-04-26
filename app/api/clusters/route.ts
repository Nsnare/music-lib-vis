import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserId, SpotifyAuthError } from '@/lib/auth';
import type { Cluster } from '@/types';

function bearerToken(req: NextRequest): string {
  return req.headers.get('Authorization')?.slice(7) ?? '';
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const cluster: Cluster = await req.json();

  await sql`
    INSERT INTO clusters (id, user_id, name, color, x, y)
    VALUES (${cluster.id}, ${userId}, ${cluster.name}, ${cluster.color}, ${cluster.x}, ${cluster.y})
    ON CONFLICT (id) DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
