import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

function emptyResponse(page = 1, limit = 50) {
  return {
    success: true,
    error: null,
    id: null,
    currentNode: null,
    parentNode: null,
    items: [],
    pagination: { page, limit, totalItems: 0, totalPages: 0, hasNext: false, hasPrev: false },
  };
}

function collectionToNode(c: Record<string, unknown>, userId: string) {
  return {
    id: c.id,
    name: c.name,
    nodeType: 'recordGroup',
    parentId: `knowledgeBase_${userId}`,
    origin: 'COLLECTION',
    connector: 'KB',
    subType: 'KB',
    hasChildren: false,
    permission: { role: 'OWNER', canEdit: true, canDelete: true },
    sharingStatus: 'private',
    createdAt: new Date(c.created_at as string).getTime(),
    updatedAt: new Date((c.updated_at ?? c.created_at) as string).getTime(),
  };
}

function documentToNode(d: Record<string, unknown>, collectionId: string) {
  return {
    id: d.id,
    name: d.name ?? d.file_name ?? 'Untitled',
    nodeType: 'record',
    parentId: collectionId,
    origin: 'COLLECTION',
    connector: 'KB',
    hasChildren: false,
    recordType: 'FILE',
    indexingStatus: d.status ?? 'COMPLETED',
    mimeType: d.file_type ?? null,
    sizeInBytes: d.file_size ?? null,
    permission: { role: 'OWNER', canEdit: true, canDelete: true },
    sharingStatus: 'private',
    createdAt: new Date(d.created_at as string).getTime(),
    updatedAt: new Date((d.updated_at ?? d.created_at) as string).getTime(),
  };
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get('nodeId');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const svc = await createServiceClient();

  // Root or app node — return collections list
  if (!nodeId || nodeId.startsWith('knowledgeBase_')) {
    const { data: collections, error } = await svc
      .from('collections')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json(emptyResponse(page, limit));

    const items = (collections ?? []).map((c) => collectionToNode(c as Record<string, unknown>, user.id));

    return NextResponse.json({
      success: true,
      error: null,
      id: null,
      currentNode: null,
      parentNode: null,
      items,
      pagination: {
        page,
        limit,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
        hasNext: false,
        hasPrev: page > 1,
      },
    });
  }

  // Specific collection node — return its documents
  const { data: collection } = await svc
    .from('collections')
    .select('*')
    .eq('id', nodeId)
    .single();

  if (!collection) return NextResponse.json(emptyResponse(page, limit));

  const { data: docs } = await svc
    .from('documents')
    .select('*')
    .eq('collection_id', nodeId)
    .order('created_at', { ascending: false });

  const items = (docs ?? []).map((d) => documentToNode(d as Record<string, unknown>, nodeId));

  return NextResponse.json({
    success: true,
    error: null,
    id: nodeId,
    currentNode: collectionToNode(collection as Record<string, unknown>, user.id),
    parentNode: null,
    items,
    pagination: {
      page,
      limit,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / limit) || 1,
      hasNext: false,
      hasPrev: page > 1,
    },
  });
}
