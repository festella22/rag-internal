import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o';
export const EMBEDDING_DIMS = 1536;

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Keep named export for rag.ts compatibility
export const openai = {
  get chat() { return getOpenAI().chat; },
  get embeddings() { return getOpenAI().embeddings; },
};

export async function embed(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return response.data.map((d) => d.embedding);
}
