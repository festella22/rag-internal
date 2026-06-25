import { NextResponse } from 'next/server';

/**
 * GET /api/v1/configurationManager/aiModelsConfig
 *
 * Returns the AI model configuration for the org.
 * Used by the chat page to populate the model selector.
 */
export async function GET() {
  const chatModel = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o';
  const configured = !!process.env.OPENAI_API_KEY;

  const models = configured
    ? [
        {
          modelKey: chatModel,
          modelName: chatModel === 'gpt-4o' ? 'GPT-4o' : chatModel,
          provider: 'openai',
          isEnabled: true,
          isDefault: true,
        },
        {
          modelKey: 'gpt-4o-mini',
          modelName: 'GPT-4o Mini',
          provider: 'openai',
          isEnabled: true,
          isDefault: false,
        },
      ]
    : [];

  return NextResponse.json({ models });
}
