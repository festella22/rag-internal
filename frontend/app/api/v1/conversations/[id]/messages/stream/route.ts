import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  const { id: conversationId } = await params;
  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? '';
  const modelName: string = body.modelName ?? 'gpt-4o-mini';
  const startTime = Date.now();

  if (!query.trim()) {
    return new Response(JSON.stringify({ message: 'Query is required' }), { status: 400 });
  }

  const svc = await createServiceClient();

  // Verify conversation exists and belongs to user
  const { data: conv } = await svc
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (!conv) {
    return new Response(JSON.stringify({ message: 'Conversation not found' }), { status: 404 });
  }

  // Save user message
  await svc.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: query,
  });

  // Fetch history for context (last 20 messages)
  const { data: history } = await svc
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      await writer.write(sseChunk('connected', {
        message: 'Connected',
        conversationId,
        title: conv.title,
      }));

      await writer.write(sseChunk('status', {
        status: 'generating',
        message: 'Generating response...',
      }));

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are PIP, an AI assistant for PI Partners — an internal knowledge search platform. Be concise, accurate, and helpful.',
        },
        ...(history ?? []).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        })),
      ];

      const stream = await openai.chat.completions.create({
        model: modelName.startsWith('gpt') || modelName.startsWith('o') ? modelName : 'gpt-4o-mini',
        messages,
        stream: true,
      });

      let accumulated = '';

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          accumulated += text;
          await writer.write(sseChunk('answer_chunk', {
            chunk: text,
            accumulated,
            citations: [],
          }));
        }
      }

      // Save assistant message
      await svc.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: accumulated,
      });

      // Update conversation timestamp
      const now = new Date().toISOString();
      await svc.from('conversations').update({ updated_at: now }).eq('id', conversationId);

      // Fetch all messages for complete event
      const { data: allMsgs } = await svc
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      await writer.write(sseChunk('complete', {
        conversation: {
          _id: conversationId,
          title: conv.title,
          userId: user.id,
          orgId: user.id,
          initiator: 'user',
          messages: (allMsgs ?? []).map((m) => ({
            _id: m.id,
            messageType: m.role === 'user' ? 'user_query' : 'bot_response',
            content: m.content,
            contentFormat: 'MARKDOWN',
            citations: [],
            followUpQuestions: [],
            referenceData: [],
            modelInfo: { model: modelName, provider: 'openai' },
            createdAt: m.created_at,
            updatedAt: m.created_at,
            feedback: [],
          })),
          isShared: false,
          isDeleted: false,
          isArchived: false,
          lastActivityAt: Date.now(),
          status: 'active',
          modelInfo: { model: modelName, provider: 'openai' },
          sharedWith: [],
          conversationErrors: [],
          createdAt: conv.created_at,
          updatedAt: now,
          __v: 0,
        },
        meta: {
          requestId: conversationId,
          timestamp: now,
          duration: Date.now() - startTime,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Streaming error';
      await writer.write(sseChunk('error', { error: msg, message: msg })).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
