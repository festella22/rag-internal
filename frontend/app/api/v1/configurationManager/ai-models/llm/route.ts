import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    provider: 'openai',
    model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
    configured: !!process.env.OPENAI_API_KEY,
  });
}
export async function POST() {
  return NextResponse.json({ success: true });
}
