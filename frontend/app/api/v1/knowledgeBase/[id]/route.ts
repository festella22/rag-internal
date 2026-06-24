import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: kb, error } = await supabase
    .from('collections')
    .select('*, documents(*)')
    .eq('id', id)
    .single();

  if (error || !kb) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({
    _id: kb.id,
    name: kb.name,
    description: kb.description,
    isPrivate: kb.is_private,
    isOwner: kb.created_by === user.id,
    documents: (kb.documents ?? []).map((d: Record<string, unknown>) => ({
      _id: d.id,
      name: d.name,
      fileType: d.file_type,
      fileSize: d.file_size,
      createdAt: d.created_at,
    })),
    createdAt: kb.created_at,
    updatedAt: kb.updated_at,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('collections')
    .update({
      name: body.name,
      description: body.description,
      is_private: body.isPrivate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ _id: data.id, name: data.name });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
