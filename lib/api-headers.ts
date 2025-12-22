import { AppSettings, AiProvider } from './types';

/**
 * Determine which AI provider to use based on settings
 * Falls back intelligently based on available API keys
 */
export function getEffectiveAiProvider(settings: AppSettings): AiProvider {
  // If explicitly set, use that
  if (settings.aiProvider) {
    return settings.aiProvider;
  }

  // Otherwise, auto-detect based on available keys
  if (settings.openaiApiKey) {
    return 'openai';
  }
  if (settings.anthropicApiKey) {
    return 'anthropic';
  }

  // Default to ollama (doesn't require API key)
  return 'ollama';
}

/**
 * Build headers for Beeper API requests
 */
export function getBeeperHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['x-beeper-token'] = token;
  }

  return headers;
}

/**
 * Build headers for Anthropic API requests
 */
export function getAnthropicHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['x-anthropic-key'] = apiKey;
  }

  return headers;
}

/**
 * Build headers for AI API requests based on settings
 * Includes both content-type and provider-specific auth headers
 */
export function getAIHeaders(settings: AppSettings): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add provider-specific headers
  // Note: We pass both keys in headers, the API routes will use the appropriate one based on provider
  if (settings.anthropicApiKey) {
    headers['x-anthropic-key'] = settings.anthropicApiKey;
  }
  if (settings.openaiApiKey) {
    headers['x-openai-key'] = settings.openaiApiKey;
  }
  // Ollama doesn't need auth headers

  return headers;
}

/**
 * Convenience function to get headers from settings context
 * Automatically selects appropriate headers based on settings
 */
export function getHeadersFromSettings(
  settings: AppSettings,
  type: 'beeper' | 'ai' = 'beeper'
): HeadersInit {
  if (type === 'beeper') {
    return getBeeperHeaders(settings.beeperAccessToken);
  }
  return getAIHeaders(settings);
}
