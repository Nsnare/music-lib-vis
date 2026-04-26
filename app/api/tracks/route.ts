import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserId, SpotifyAuthError } from '@/lib/auth';

function bearerToken(req: NextRequest): string {
  return req.headers.get('Authorization')?.slice(7) ?? '';
}

export async function PUT(req: NextRequest) {
  let userId: string;
  try {
    userId = await getUserId(bearerToken(req));
  } catch (e) {
    if (e instanceof SpotifyAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }

  const { id, x, y }: { id: string; x: number; y: number } = await req.json();

  await sql`
    INSERT INTO track_positions (id, user_id, x, y)
    VALUES (${id}, ${userId}, ${x}, ${y})
    ON CONFLICT (id, user_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y
  `;

  return NextResponse.json({ ok: true });
}
