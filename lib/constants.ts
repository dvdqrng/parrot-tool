/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

/**
 * Polling and refresh intervals (in milliseconds)
 */
export const POLLING_INTERVALS = {
  /** Message polling interval - 10 seconds */
  MESSAGES: 10_000,
  /** Delay before refreshing after send - 1 second */
  REFRESH_DELAY: 1_000,
  /** Autopilot pending drafts check - 500ms */
  PENDING_DRAFTS_CHECK: 500,
} as const;

/**
 * Autopilot system limits and thresholds
 */
export const AUTOPILOT_LIMITS = {
  /** Maximum messages to keep in processed cache */
  MAX_PROCESSED_MESSAGES: 500,
  /** Cleanup threshold for processed messages */
  CLEANUP_THRESHOLD: 500,
  /** Default conversation fatigue trigger (number of messages) */
  DEFAULT_FATIGUE_TRIGGER: 15,
  /** Default fatigue response rate reduction (%) */
  DEFAULT_FATIGUE_REDUCTION: 5,
  /** Maximum fatigue reduction cap (%) */
  MAX_FATIGUE_REDUCTION: 50,
  /** Minimum response rate after fatigue (%) */
  MIN_RESPONSE_RATE: 30,
} as const;

/**
 * Storage and cache limits
 */
export const STORAGE_LIMITS = {
  /** Maximum number of items to keep in various caches */
  CACHE_MAX_ITEMS: 500,
  /** Maximum AI chat history messages per thread */
  MAX_CHAT_HISTORY: 50,
} as const;

/**
 * UI and interaction delays (in milliseconds)
 */
export const UI_DELAYS = {
  /** Debounce delay for search/filter inputs */
  DEBOUNCE: 300,
  /** Animation duration for transitions */
  ANIMATION: 200,
  /** Tooltip show delay */
  TOOLTIP: 500,
} as const;

/**
 * Batch operation settings
 */
export const BATCH_OPERATIONS = {
  /** Delay between batch draft generations (ms) */
  DRAFT_GENERATION_DELAY: 500,
  /** Delay between batch message sends (ms) */
  SEND_DELAY: 1_000,
  /** Maximum concurrent batch operations */
  MAX_CONCURRENT: 3,
} as const;

/**
 * Message and text limits
 */
export const TEXT_LIMITS = {
  /** Preview text truncation length */
  PREVIEW_LENGTH: 100,
  /** Card title truncation length */
  CARD_TITLE_LENGTH: 50,
  /** Debug log text truncation */
  DEBUG_TEXT_LENGTH: 50,
  /** Maximum message length */
  MAX_MESSAGE_LENGTH: 5000,
} as const;

/**
 * API and network settings
 */
export const API_SETTINGS = {
  /** Default API request timeout (ms) */
  TIMEOUT: 30_000,
  /** Retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
  /** Delay between retries (ms) */
  RETRY_DELAY: 1_000,
} as const;

/**
 * LocalStorage keys
 * Centralized for easy reference and migration
 */
export const STORAGE_KEYS = {
  DRAFTS: 'parrot-drafts',
  SETTINGS: 'parrot-settings',
  MESSAGES: 'parrot-messages',
  ACCOUNTS: 'parrot-accounts',
  AVATARS: 'parrot-avatars',
  CHAT_INFO: 'parrot-chat-info',
  HIDDEN_CHATS: 'parrot-hidden-chats',
  HIDDEN_CHATS_META: 'parrot-hidden-chats-meta',
  TONE_SETTINGS: 'parrot-tone-settings',
  WRITING_STYLE: 'parrot-writing-style',
  AI_CHAT_HISTORY: 'parrot-ai-chat-history',
  USER_MESSAGES: 'parrot-user-messages',
  THREAD_CONTEXT: 'parrot-thread-context',
  AUTOPILOT_AGENTS: 'parrot-autopilot-agents',
  AUTOPILOT_CHAT_CONFIGS: 'parrot-autopilot-chat-configs',
  AUTOPILOT_ACTIVITY: 'parrot-autopilot-activity',
  AUTOPILOT_SCHEDULED: 'parrot-autopilot-scheduled',
  AUTOPILOT_HANDOFFS: 'parrot-autopilot-handoffs',
  CACHE_TIMESTAMP: 'parrot-cache-timestamp',
  // CRM storage keys
  CRM_CONTACTS: 'parrot-crm-contacts',
  CRM_TAGS: 'parrot-crm-tags',
  CRM_CHAT_MAPPINGS: 'parrot-crm-chat-mappings',
} as const;

/**
 * Feature flags
 * Toggle features on/off for development or gradual rollout
 */
export const FEATURE_FLAGS = {
  /** Enable debug logging in production */
  DEBUG_IN_PRODUCTION: false,
  /** Enable performance monitoring */
  PERFORMANCE_MONITORING: false,
  /** Enable experimental features */
  EXPERIMENTAL: false,
} as const;
