import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ unread: 0, total: 0 });
}
