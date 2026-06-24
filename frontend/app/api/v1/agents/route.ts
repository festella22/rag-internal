import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ agents: [], total: 0 });
}

export async function POST() {
  return NextResponse.json({ message: 'Agents not available in this version' }, { status: 501 });
}
