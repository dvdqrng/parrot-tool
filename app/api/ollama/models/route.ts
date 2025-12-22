import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { listOllamaModels, checkOllamaHealth, RECOMMENDED_MODELS } from '@/lib/ollama';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = searchParams.get('baseUrl') || undefined;

  try {
    // First check if Ollama is running
    const isHealthy = await checkOllamaHealth(baseUrl);

    if (!isHealthy) {
      return NextResponse.json({
        data: {
          available: false,
          models: [],
          recommended: RECOMMENDED_MODELS,
          error: 'Ollama is not running. Start it with: ollama serve',
        }
      });
    }

    // Get list of installed models
    const models = await listOllamaModels(baseUrl);

    return NextResponse.json({
      data: {
        available: true,
        models: models.map(m => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modified_at,
        })),
        recommended: RECOMMENDED_MODELS,
      }
    });
  } catch (error) {
    logger.error('Error checking Ollama:', error instanceof Error ? error : String(error));
    return NextResponse.json({
      data: {
        available: false,
        models: [],
        recommended: RECOMMENDED_MODELS,
        error: 'Failed to connect to Ollama',
      }
    });
  }
}
