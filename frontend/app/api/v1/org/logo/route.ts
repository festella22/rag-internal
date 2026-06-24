import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ logoUrl: null });
}
export async function POST() {
  return NextResponse.json({ success: true });
}
