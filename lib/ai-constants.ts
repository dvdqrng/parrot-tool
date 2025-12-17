/**
 * AI-related constants
 * Centralized configuration for AI models, tokens, and behavior
 */

// Default models for each provider
export const DEFAULT_OLLAMA_MODEL = 'deepseek-v3';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// Token limits for different use cases
export const AI_TOKENS = {
  DRAFT: 300,           // Draft generation
  CHAT: 1024,           // AI chat assistant
  SUMMARY: 500,         // Conversation summary
} as const;

// Temperature settings for different use cases
export const AI_TEMPERATURE = {
  DRAFT: 0.8,           // More creative for drafts
  CHAT: 0.7,            // Balanced for conversation
  SUMMARY: 0.5,         // More focused for summaries
} as const;

// Autopilot constants
export const AUTOPILOT = {
  // Manual approval delay (24 hours in seconds)
  PENDING_APPROVAL_DELAY: 24 * 60 * 60,

  // Typing speed for simulation
  DEFAULT_TYPING_SPEED_WPM: 40,

  // Processing limits
  MAX_PROCESSED_MESSAGES: 100,
} as const;
