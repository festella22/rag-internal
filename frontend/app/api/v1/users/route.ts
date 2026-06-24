import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  return NextResponse.json({
    users: [{
      _id: user.id,
      id: user.id,
      email: user.email,
      fullName,
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' ') ?? '',
      isAdmin: true,
    }],
    total: 1,
  });
}
