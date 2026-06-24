import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    orgName: 'PI Partners',
    logoUrl: null,
    configured: true,
  });
}
export async function PUT() {
  return NextResponse.json({ success: true });
}
