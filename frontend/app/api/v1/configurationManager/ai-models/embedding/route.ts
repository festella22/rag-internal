import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    provider: 'openai',
    model: 'text-embedding-3-small',
    configured: !!process.env.OPENAI_API_KEY,
  });
}
export async function POST() {
  return NextResponse.json({ success: true });
}
