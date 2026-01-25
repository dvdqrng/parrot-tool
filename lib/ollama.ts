// Ollama API client utilities
import { logger } from './logger';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export async function ollamaChat(
  baseUrl: string | undefined,
  model: string,
  messages: OllamaMessage[],
  maxTokens: number = 1024,
  temperature: number = 0.7
): Promise<string> {
  const url = baseUrl || DEFAULT_OLLAMA_URL;

  // Qwen3 models need /no_think suffix to disable thinking mode and get actual output
  const isQwen3 = model.toLowerCase().startsWith('qwen3');
  const processedMessages = isQwen3
    ? messages.map((msg, idx) => {
        // Add /no_think to the last user message
        if (msg.role === 'user' && idx === messages.length - 1) {
          return { ...msg, content: msg.content + ' /no_think' };
        }
        return msg;
      })
    : messages;

  const response = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: processedMessages,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature,
      },
    } as OllamaChatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${errorText}`);
  }

  const data: OllamaChatResponse = await response.json();
  logger.debug('[Ollama] Response:', {
    model: data.model,
    done: data.done,
    contentLength: data.message?.content?.length ?? 0,
    contentPreview: data.message?.content?.slice(0, 200) ?? '(empty)',
  });
  return data.message.content;
}

export async function listOllamaModels(baseUrl?: string): Promise<OllamaModel[]> {
  const url = baseUrl || DEFAULT_OLLAMA_URL;

  const response = await fetch(`${url}/api/tags`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to list Ollama models: ${response.status}`);
  }

  const data: OllamaListResponse = await response.json();
  return data.models || [];
}

export async function checkOllamaHealth(baseUrl?: string): Promise<boolean> {
  const url = baseUrl || DEFAULT_OLLAMA_URL;

  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getFirstAvailableModel(baseUrl?: string): Promise<string | null> {
  try {
    const models = await listOllamaModels(baseUrl);
    return models.length > 0 ? models[0].name : null;
  } catch {
    return null;
  }
}

// Default recommended models for different tasks
// DeepSeek-V3 is the best for human writing style matching as of Dec 2025
// Note: DeepSeek-R1 models output reasoning - we filter it out automatically
export const RECOMMENDED_MODELS = [
  { name: 'deepseek-v3', description: 'DeepSeek-V3 - BEST for style matching (recommended)' },
  { name: 'qwen2.5:32b', description: 'Qwen 2.5 32B - Excellent, no reasoning overhead' },
  { name: 'qwen2.5:14b', description: 'Qwen 2.5 14B - Great balance' },
  { name: 'llama3.3:70b', description: 'Llama 3.3 70B - Highest quality (large)' },
  { name: 'deepseek-r1:70b', description: 'DeepSeek R1 70B - Shows reasoning (filtered)' },
  { name: 'deepseek-r1:32b', description: 'DeepSeek R1 32B - Shows reasoning (filtered)' },
  { name: 'deepseek-r1:14b', description: 'DeepSeek R1 14B - Shows reasoning (filtered)' },
  { name: 'deepseek-r1:8b', description: 'DeepSeek R1 8B - Shows reasoning (filtered)' },
  { name: 'llama3.1:8b', description: 'Llama 3.1 8B - Fast and reliable' },
  { name: 'mistral:7b', description: 'Mistral 7B - Fast option' },
];
