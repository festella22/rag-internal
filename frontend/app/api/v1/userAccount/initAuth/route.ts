import { NextRequest, NextResponse } from 'next/server';

// Tells the frontend which auth methods are available
export async function POST(_req: NextRequest) {
  return NextResponse.json({
    currentStep: 1,
    allowedMethods: ['password'],
    message: 'Enter your credentials',
    authProviders: {},
  });
}
