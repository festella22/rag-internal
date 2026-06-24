import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ connectors: [], total: 0 });
}
export async function POST() {
  return NextResponse.json({ message: 'Connector setup coming soon' }, { status: 501 });
}
