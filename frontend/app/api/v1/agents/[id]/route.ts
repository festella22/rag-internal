import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Not found' }, { status: 404 });
}
export async function PUT() {
  return NextResponse.json({ message: 'Not available' }, { status: 501 });
}
export async function DELETE() {
  return NextResponse.json({ message: 'Not available' }, { status: 501 });
}
