import { NextResponse } from 'next/server';

// Catch socket.io polling requests — no WebSocket server in this deployment.
// Returns a socket.io-formatted error so the client fails gracefully
// instead of showing 404/405 toasts via the axios interceptor.
export async function GET() {
  return new NextResponse(null, { status: 204 });
}
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
