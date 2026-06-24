import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { retrieve, streamAnswer } from '@/lib/rag';

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const body = await req.json();
  const query: string = body.message ?? body.content ?? '';

  if (!query.trim()) {
    return NextResponse.json({ message: 'Message required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from('conversations')
    .select('collection_id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (!conv) return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });

  // Persist user message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: query,
  });

  // Load recent history for context
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentHistory = (history ?? [])
    .reverse()
    .slice(0, -1) // exclude the message we just inserted
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseEvent('connected', { conversationId })));
        controller.enqueue(encoder.encode(sseEvent('status', { message: 'Searching knowledge base...' })));

        const chunks = await retrieve({
          query,
          collectionId: conv.collection_id ?? undefined,
          topK: 8,
        });

        controller.enqueue(encoder.encode(sseEvent('status', { message: 'Generating answer...' })));

        let fullAnswer = '';

        for await (const delta of streamAnswer({ query, chunks, history: recentHistory })) {
          fullAnswer += delta;
          controller.enqueue(encoder.encode(sseEvent('answer_chunk', { chunk: delta })));
        }

        const citations = chunks.slice(0, 5).map((c, i) => ({
          index: i + 1,
          content: c.content.slice(0, 200),
          documentId: c.document_id,
        }));

        // Persist assistant message
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullAnswer,
          citations,
        });

        // Update conversation timestamp + auto-title on first message
        const updatePayload: Record<string, string> = { updated_at: new Date().toISOString() };
        if (recentHistory.length === 0) {
          updatePayload.title = query.slice(0, 60);
        }
        await supabase.from('conversations').update(updatePayload).eq('id', conversationId);

        controller.enqueue(
          encoder.encode(
            sseEvent('complete', {
              answer: fullAnswer,
              citations,
              conversationId,
            }),
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(sseEvent('error', { message })));
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    messages: (data ?? []).map((m) => ({
      _id: m.id,
      role: m.role,
      content: m.content,
      citations: m.citations ?? [],
      createdAt: m.created_at,
    })),
  });
}
