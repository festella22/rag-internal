import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const fullName = user.user_metadata?.full_name ?? '';
  const parts = fullName.trim().split(' ');
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') ?? '';

  return NextResponse.json({
    id: user.id,
    _id: user.id,
    email: user.email,
    fullName,
    firstName,
    lastName,
    hasLoggedIn: true,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Support both {fullName} (from FullNameDialog) and {firstName, lastName} (from profile page)
  const fullName = (
    body.fullName ??
    `${body.firstName ?? ''} ${body.lastName ?? ''}`.trim()
  ).trim();

  // Use service role admin client — server-side auth.updateUser requires cookies
  // but this route uses Bearer token auth, so we update via admin API instead.
  const svc = await createServiceClient();
  await svc.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: fullName },
  });

  return NextResponse.json({ success: true });
}
