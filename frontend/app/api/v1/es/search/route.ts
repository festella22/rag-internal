import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieve } from '@/lib/rag';

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? searchParams.get('query') ?? '';
  const collectionId = searchParams.get('kbId') ?? undefined;

  if (!query.trim()) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const chunks = await retrieve({ query, collectionId, topK: 10 });

  const results = chunks.map((c, i) => ({
    _id: c.id,
    rank: i + 1,
    content: c.content,
    similarity: c.similarity,
    documentId: c.document_id,
    collectionId: c.collection_id,
  }));

  return NextResponse.json({ results, total: results.length, query });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const query: string = body.query ?? body.q ?? '';
  const collectionId: string | undefined = body.kbId ?? undefined;

  if (!query.trim()) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const chunks = await retrieve({ query, collectionId, topK: 10 });

  const results = chunks.map((c, i) => ({
    _id: c.id,
    rank: i + 1,
    content: c.content,
    similarity: c.similarity,
    documentId: c.document_id,
    collectionId: c.collection_id,
  }));

  return NextResponse.json({ results, total: results.length, query });
}
