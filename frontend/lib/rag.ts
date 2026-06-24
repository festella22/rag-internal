import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createServiceClient } from '@/lib/supabase/server';
import { embed, embedBatch, getOpenAI, CHAT_MODEL } from '@/lib/openai';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

export async function ingestDocument(params: {
  documentId: string;
  collectionId: string;
  text: string;
}) {
  const { documentId, collectionId, text } = params;
  const supabase = await createServiceClient();
  const chunks = chunkText(text);

  if (chunks.length === 0) return;

  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((content, i) => ({
    document_id: documentId,
    collection_id: collectionId,
    content,
    embedding: JSON.stringify(embeddings[i]),
    chunk_index: i,
  }));

  const { error } = await supabase.from('document_chunks').insert(rows);
  if (error) throw new Error(`Ingestion failed: ${error.message}`);
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  collection_id: string;
  content: string;
  similarity: number;
}

export async function retrieve(params: {
  query: string;
  collectionId?: string;
  topK?: number;
}): Promise<RetrievedChunk[]> {
  const { query, collectionId, topK = 8 } = params;
  const supabase = await createServiceClient();
  const queryEmbedding = await embed(query);

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter_collection_id: collectionId ?? null,
  });

  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

export async function* streamAnswer(params: {
  query: string;
  chunks: RetrievedChunk[];
  history: { role: 'user' | 'assistant'; content: string }[];
}): AsyncGenerator<string> {
  const { query, chunks, history } = params;

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join('\n\n');

  const systemPrompt = `You are an internal knowledge assistant. Answer questions using only the provided context from company documents. Be concise and cite sources with [1], [2], etc. If the answer isn't in the context, say so.

Context:
${context}`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: query },
  ];

  const stream = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages,
    stream: true,
    temperature: 0.2,
    max_tokens: 1500,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
