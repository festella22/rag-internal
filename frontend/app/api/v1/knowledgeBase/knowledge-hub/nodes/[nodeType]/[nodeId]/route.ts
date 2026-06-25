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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nodeType: string; nodeId: string }> }
) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { nodeType, nodeId } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const svc = await createServiceClient();

  // App node (knowledgeBase hub) — return all collections
  if (nodeType === 'app') {
    const { data: collections } = await svc
      .from('collections')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    const items = (collections ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      nodeType: 'recordGroup',
      parentId: `apps/${nodeId}`,
      origin: 'COLLECTION',
      connector: 'KB',
      subType: 'KB',
      hasChildren: false,
      permission: { role: 'OWNER', canEdit: true, canDelete: true },
      sharingStatus: 'private',
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at ?? c.created_at).getTime(),
    }));

    return NextResponse.json({
      success: true,
      error: null,
      id: nodeId,
      currentNode: { id: nodeId, name: 'Collections', nodeType: 'app' },
      parentNode: null,
      items,
      pagination: {
        page,
        limit,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  }

  // recordGroup / kb — return documents inside that collection
  if (nodeType === 'recordGroup' || nodeType === 'kb' || nodeType === 'folder') {
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

    const items = (docs ?? []).map((d) => ({
      id: d.id,
      name: d.name ?? d.file_name ?? 'Untitled',
      nodeType: 'record',
      parentId: nodeId,
      origin: 'COLLECTION',
      connector: 'KB',
      hasChildren: false,
      recordType: 'FILE',
      indexingStatus: 'COMPLETED',
      mimeType: d.file_type ?? null,
      sizeInBytes: d.file_size ?? null,
      permission: { role: 'OWNER', canEdit: true, canDelete: true },
      sharingStatus: 'private',
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at ?? d.created_at).getTime(),
    }));

    return NextResponse.json({
      success: true,
      error: null,
      id: nodeId,
      currentNode: {
        id: collection.id,
        name: collection.name,
        nodeType: 'recordGroup',
        origin: 'COLLECTION',
      },
      parentNode: null,
      items,
      breadcrumbs: [{ id: collection.id, name: collection.name, nodeType: 'recordGroup' }],
      pagination: {
        page,
        limit,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  }

  return NextResponse.json(emptyResponse(page, limit));
}
