import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { retrieve, type RetrievedChunk } from '@/lib/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser(token);
  const user = authData.user;
  if (!user) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? '';
  const modelName: string = body.modelName ?? 'gpt-4o-mini';
  const collectionId: string | undefined = body.collectionId ?? undefined;
  const startTime = Date.now();

  if (!query.trim()) {
    return new Response(JSON.stringify({ message: 'Query is required' }), { status: 400 });
  }

  const svc = await createServiceClient();

  // Generate a short title from the first ~60 chars of the query
  const title = query.length > 60 ? query.slice(0, 57) + '...' : query;

  // Create conversation
  const { data: conv, error: convErr } = await svc
    .from('conversations')
    .insert({ user_id: user.id, title })
    .select()
    .single();

  if (convErr || !conv) {
    return new Response(JSON.stringify({ message: convErr?.message ?? 'Failed to create conversation' }), { status: 500 });
  }

  const conversationId: string = conv.id;

  // Save user message
  await svc.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: query,
  });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      await writer.write(sseChunk('connected', {
        message: 'Connected',
        conversationId,
        title,
      }));

      // Retrieve relevant chunks from indexed documents
      await writer.write(sseChunk('status', {
        status: 'retrieving',
        message: 'Searching documents...',
      }));

      let chunks: RetrievedChunk[] = [];
      try {
        chunks = await retrieve({ query, collectionId, topK: 6 });
      } catch {
        // Retrieval failure is non-fatal — continue without context
      }

      await writer.write(sseChunk('status', {
        status: 'generating',
        message: 'Generating response...',
      }));

      // Build a grounded system prompt when we have retrieved context
      const systemPrompt = chunks.length > 0
        ? `You are PIP, an AI assistant for PI Partners — an internal knowledge search platform.
Answer the user's question using only the provided context from their documents.
Be concise and accurate. Cite sources using [1], [2], etc. when referencing specific content.
If the answer isn't in the context, say so clearly rather than guessing.

Context from your documents:
${chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`
        : `You are PIP, an AI assistant for PI Partners — an internal knowledge search platform.
Be concise, accurate, and helpful.
Note: no relevant documents were found for this query. You may answer from general knowledge but make clear you are not drawing from indexed documents.`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const effectiveModel =
        modelName.startsWith('gpt') || modelName.startsWith('o')
          ? modelName
          : 'gpt-4o-mini';

      const stream = await openai.chat.completions.create({
        model: effectiveModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        stream: true,
        temperature: 0.2,
        max_tokens: 1500,
      });

      let accumulated = '';

      const citationMeta = chunks.map((c, i) => ({
        index: i + 1,
        id: c.id,
        documentId: c.document_id,
        similarity: Math.round(c.similarity * 100) / 100,
        preview: c.content.slice(0, 150),
      }));

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          accumulated += text;
          await writer.write(sseChunk('answer_chunk', {
            chunk: text,
            accumulated,
            citations: citationMeta,
          }));
        }
      }

      // Save assistant message
      await svc
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: accumulated,
        })
        .select()
        .single();

      // Fetch all messages for the complete event
      const { data: allMsgs } = await svc
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      const now = new Date().toISOString();

      await writer.write(sseChunk('complete', {
        conversation: {
          _id: conversationId,
          title,
          userId: user.id,
          orgId: user.id,
          initiator: 'user',
          messages: (allMsgs ?? []).map((m) => ({
            _id: m.id,
            messageType: m.role === 'user' ? 'user_query' : 'bot_response',
            content: m.content,
            contentFormat: 'MARKDOWN',
            citations: citationMeta,
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
          retrievedChunks: chunks.length,
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
