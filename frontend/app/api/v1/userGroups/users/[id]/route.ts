import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Returns array of group objects — profile initializer checks g.type === 'ADMIN'
  return NextResponse.json([
    { _id: `admin-${id}`, type: 'ADMIN', name: 'Administrators' },
  ]);
}
