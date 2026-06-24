import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const fullName = data.user.user_metadata?.full_name ?? '';
  const parts = fullName.trim().split(' ');
  return NextResponse.json({
    id: data.user.id,
    email: data.user.email,
    fullName,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' ') ?? '',
  });
}

export async function PUT(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await supabase.auth.updateUser({ data: { full_name: body.fullName ?? body.full_name } });
  return NextResponse.json({ success: true });
}
