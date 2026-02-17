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
  CACHE_TIMESTAMP: 'parrot-cache-timestamp',
  // CRM storage keys
  CRM_CONTACTS: 'parrot-crm-contacts',
  CRM_TAGS: 'parrot-crm-tags',
  CRM_CHAT_MAPPINGS: 'parrot-crm-chat-mappings',
  // Authenticated user info from Beeper
  USER_INFO: 'parrot-user-info',
} as const;
