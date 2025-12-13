// Ollama API client utilities

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
  maxTokens: number = 1024
): Promise<string> {
  const url = baseUrl || DEFAULT_OLLAMA_URL;

  const response = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        num_predict: maxTokens,
      },
    } as OllamaChatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${errorText}`);
  }

  const data: OllamaChatResponse = await response.json();
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

// Default recommended models for different tasks
export const RECOMMENDED_MODELS = [
  { name: 'llama3.1:8b', description: 'Best balance of quality and speed' },
  { name: 'llama3.2:3b', description: 'Faster, good for simple tasks' },
  { name: 'mistral:7b', description: 'Fast and reliable' },
  { name: 'qwen2.5:7b', description: 'Strong instruction following' },
  { name: 'phi4:14b', description: 'Higher quality, needs more RAM' },
];
