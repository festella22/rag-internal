import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    services: {
      query: 'healthy',
      connector: 'healthy',
      indexing: 'healthy',
      embedding: 'healthy',
    },
    infraServices: {
      database: 'healthy',
      vectorStore: 'healthy',
    },
    infraServiceNames: {
      database: 'Supabase',
      vectorStore: 'pgvector',
    },
  });
}
