import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ingestDocument } from '@/lib/rag';

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return buffer.toString('utf-8');
  }

  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      return JSON.stringify(parsed, null, 2);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  // For other file types return the raw text (works for CSV, HTML, etc.)
  return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const collectionId = formData.get('kbId') as string | null;

  if (!file) return NextResponse.json({ message: 'No file provided' }, { status: 400 });
  if (!collectionId) return NextResponse.json({ message: 'Collection ID required' }, { status: 400 });

  const supabase = await createServiceClient();

  // Store file in Supabase Storage
  const storagePath = `${user.id}/${collectionId}/${Date.now()}-${file.name}`;
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { upsert: false });

  if (storageError && !storageError.message.includes('already exists')) {
    console.warn('Storage upload warning:', storageError.message);
  }

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      collection_id: collectionId,
      name: file.name,
      file_type: file.type || 'text/plain',
      file_size: file.size,
      storage_path: storagePath,
      created_by: user.id,
    })
    .select()
    .single();

  if (docError) return NextResponse.json({ message: docError.message }, { status: 500 });

  // Extract text and ingest into pgvector (async — don't block response)
  extractText(file)
    .then((text) => {
      if (text.trim().length > 0) {
        return ingestDocument({ documentId: doc.id, collectionId, text });
      }
    })
    .catch((err) => console.error('Ingestion error:', err));

  return NextResponse.json({
    _id: doc.id,
    name: doc.name,
    fileType: doc.file_type,
    fileSize: doc.file_size,
    collectionId,
    createdAt: doc.created_at,
    status: 'processing',
  });
}
