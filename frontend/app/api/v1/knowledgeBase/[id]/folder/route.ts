import { NextRequest, NextResponse } from 'next/server';

// Stub — folder creation inside a collection (not yet implemented)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({
    id: `folder-${Date.now()}`,
    name: 'New Folder',
    nodeType: 'folder',
    parentId: id,
  });
}
