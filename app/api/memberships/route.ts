import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserId, SpotifyAuthError } from '@/lib/auth';

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

  const { trackId, clusterId }: { trackId: string; clusterId: string } = await req.json();

  await sql`
    INSERT INTO memberships (track_id, cluster_id, user_id)
    VALUES (${trackId}, ${clusterId}, ${userId})
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { trackId, clusterId }: { trackId: string; clusterId: string } = await req.json();

  await sql`
    DELETE FROM memberships
    WHERE track_id = ${trackId} AND cluster_id = ${clusterId} AND user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}
