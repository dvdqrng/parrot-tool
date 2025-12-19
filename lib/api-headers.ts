import { AppSettings } from './types';

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
  if (settings.aiProvider === 'anthropic' && settings.anthropicApiKey) {
    headers['x-anthropic-key'] = settings.anthropicApiKey;
  }
  // OpenAI key is passed in body, not header
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
