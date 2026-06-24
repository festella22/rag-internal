import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ results: [], total: 0, query: '' });
}
export async function POST() {
  return NextResponse.json({ results: [], total: 0, query: '' });
}
