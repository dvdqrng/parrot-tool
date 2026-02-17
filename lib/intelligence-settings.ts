/**
 * Intelligence Settings
 * Stores API keys and feature toggles in localStorage
 */

const STORAGE_KEY = 'beeper-intelligence-settings';

export type AIProvider = 'anthropic' | 'openai';

export interface IntelligenceSettings {
  // Provider selection
  provider: AIProvider;
  // API Keys
  anthropicApiKey: string;
  openaiApiKey: string;
  // Legacy field for backwards compatibility
  apiKey?: string;
  // Feature toggles
  enableExtraction: boolean;
  enableAmbientProcessing: boolean;
  enableProactiveSuggestions: boolean;
}

const defaultSettings: IntelligenceSettings = {
  provider: 'anthropic',
  anthropicApiKey: '',
  openaiApiKey: '',
  enableExtraction: true,
  enableAmbientProcessing: true,
  enableProactiveSuggestions: true,
};

export function loadIntelligenceSettings(): IntelligenceSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultSettings;
    }
    const parsed = JSON.parse(stored);

    // Migration: convert old apiKey to anthropicApiKey
    if (parsed.apiKey && !parsed.anthropicApiKey) {
      parsed.anthropicApiKey = parsed.apiKey;
      delete parsed.apiKey;
    }

    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

export function saveIntelligenceSettings(settings: IntelligenceSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save intelligence settings:', error);
  }
}

export function getApiKey(provider?: AIProvider): string {
  const settings = loadIntelligenceSettings();
  const activeProvider = provider || settings.provider;

  if (activeProvider === 'openai') {
    return settings.openaiApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
  }

  return settings.anthropicApiKey || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '';
}

export function getActiveProvider(): AIProvider {
  const settings = loadIntelligenceSettings();
  return settings.provider;
}

export function hasApiKey(): boolean {
  const settings = loadIntelligenceSettings();
  if (settings.provider === 'openai') {
    return !!settings.openaiApiKey;
  }
  return !!settings.anthropicApiKey;
}

export function isFeatureEnabled(feature: 'enableExtraction' | 'enableAmbientProcessing' | 'enableProactiveSuggestions'): boolean {
  const settings = loadIntelligenceSettings();
  return settings[feature] ?? true;
}
