import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'configured' });
}

export async function PUT() {
  return NextResponse.json({ success: true });
}
