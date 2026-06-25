import { NextResponse } from 'next/server';

/**
 * GET /api/v1/configurationManager/ai-models/available/llm
 *
 * Returns the list of LLM models available to the org for chat.
 * Used by the chat page model picker.
 */
export async function GET() {
  const chatModel = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o';
  const configured = !!process.env.OPENAI_API_KEY;

  const models = configured
    ? [
        {
          modelType: 'llm',
          provider: 'openai',
          modelName: chatModel === 'gpt-4o' ? 'GPT-4o' : chatModel,
          modelKey: chatModel,
          isMultimodal: chatModel.startsWith('gpt-4'),
          isReasoning: chatModel.startsWith('o'),
          isDefault: true,
          isEnabled: true,
        },
        {
          modelType: 'llm',
          provider: 'openai',
          modelName: 'GPT-4o Mini',
          modelKey: 'gpt-4o-mini',
          isMultimodal: true,
          isReasoning: false,
          isDefault: false,
          isEnabled: true,
        },
      ]
    : [];

  return NextResponse.json({
    status: configured ? 'configured' : 'not_configured',
    models,
    message: configured ? 'Models available' : 'OpenAI API key not configured',
  });
}
