import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserId, SpotifyAuthError } from '@/lib/auth';

function bearerToken(req: NextRequest): string {
  return req.headers.get('Authorization')?.slice(7) ?? '';
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const body: { x?: number; y?: number; name?: string; color?: string } = await req.json();

  if (body.x !== undefined && body.y !== undefined) {
    await sql`UPDATE clusters SET x = ${body.x}, y = ${body.y} WHERE id = ${id} AND user_id = ${userId}`;
  }
  if (body.name !== undefined) {
    await sql`UPDATE clusters SET name = ${body.name} WHERE id = ${id} AND user_id = ${userId}`;
  }
  if (body.color !== undefined) {
    await sql`UPDATE clusters SET color = ${body.color} WHERE id = ${id} AND user_id = ${userId}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { id } = await params;

  await Promise.all([
    sql`DELETE FROM memberships WHERE cluster_id = ${id} AND user_id = ${userId}`,
    sql`DELETE FROM clusters WHERE id = ${id} AND user_id = ${userId}`,
  ]);

  return NextResponse.json({ ok: true });
}
