import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserId, SpotifyAuthError } from '@/lib/auth';
import type { Cluster, Membership } from '@/types';

function bearerToken(req: NextRequest): string {
  return req.headers.get('Authorization')?.slice(7) ?? '';
}

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const [tracks, clusters, memberships] = await Promise.all([
    sql`SELECT id, x, y FROM track_positions WHERE user_id = ${userId}`,
    sql`SELECT id, name, color, x, y FROM clusters WHERE user_id = ${userId}`,
    sql`SELECT track_id AS "trackId", cluster_id AS "clusterId" FROM memberships WHERE user_id = ${userId}`,
  ]);

  return NextResponse.json({
    tracks: tracks as { id: string; x: number; y: number }[],
    clusters: clusters as Cluster[],
    memberships: memberships as Membership[],
  });
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const body: LayoutData = await req.json();

  await Promise.all([
    ...body.tracks.map((t) =>
      sql`INSERT INTO track_positions (id, user_id, x, y)
          VALUES (${t.id}, ${userId}, ${t.x}, ${t.y})
          ON CONFLICT (id, user_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y`
    ),
    ...body.clusters.map((c) =>
      sql`INSERT INTO clusters (id, user_id, name, color, x, y)
          VALUES (${c.id}, ${userId}, ${c.name}, ${c.color}, ${c.x}, ${c.y})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, x = EXCLUDED.x, y = EXCLUDED.y`
    ),
    ...body.memberships.map((m) =>
      sql`INSERT INTO memberships (track_id, cluster_id, user_id)
          VALUES (${m.trackId}, ${m.clusterId}, ${userId})
          ON CONFLICT DO NOTHING`
    ),
  ]);

  return NextResponse.json({ ok: true });
}
