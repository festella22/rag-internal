import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ teams: [], total: 0 });
}
export async function POST() {
  return NextResponse.json({ message: 'Not available' }, { status: 501 });
}
