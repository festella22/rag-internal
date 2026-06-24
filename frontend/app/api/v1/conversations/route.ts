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

  const supabase = await createServiceClient();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';

  let query = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const conversations = (data ?? []).map((c) => ({
    _id: c.id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isOwner: true,
    isShared: false,
    sharedWith: [],
    status: 'active',
  }));

  return NextResponse.json({ conversations, total: conversations.length });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      collection_id: body.kbId ?? null,
      title: body.title ?? 'New Conversation',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    _id: data.id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isOwner: true,
    isShared: false,
    sharedWith: [],
    status: 'active',
  });
}
