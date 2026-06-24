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

  const { data, error } = await supabase
    .from('collections')
    .select('*, documents(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const knowledgeBases = (data ?? []).map((kb) => ({
    _id: kb.id,
    name: kb.name,
    description: kb.description ?? '',
    isPrivate: kb.is_private,
    isOwner: kb.created_by === user.id,
    documentCount: (kb.documents as unknown as { count: number }[])?.[0]?.count ?? 0,
    createdAt: kb.created_at,
    updatedAt: kb.updated_at,
  }));

  return NextResponse.json({ knowledgeBases });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.kbName ?? body.name ?? '').trim();
  const description = (body.kbDescription ?? body.description ?? '').trim();

  if (!name) {
    return NextResponse.json({ message: 'Name is required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('collections')
    .insert({
      name,
      description,
      is_private: body.isPrivate ?? false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    _id: data.id,
    name: data.name,
    description: data.description,
    isPrivate: data.is_private,
    isOwner: true,
    userRole: 'owner',
    documentCount: 0,
    createdAtTimestamp: new Date(data.created_at).getTime(),
    updatedAtTimestamp: new Date(data.updated_at).getTime(),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
