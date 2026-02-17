/**
 * Unified Beeper Data Pipeline Types
 * Single source of truth for all data fetching
 */

import { BeeperAccount, BeeperMessage, BeeperUserInfo } from '@/lib/types';

/**
 * Available data slices that can be requested
 */
export type DataSlice = 'accounts' | 'messages' | 'userInfo';

/**
 * Request parameters for the unified data endpoint
 */
export interface BeeperDataRequest {
  slices: DataSlice[];
  accountIds?: string[];
  hiddenChatIds?: string[];
  cursor?: string;
}

/**
 * Chat info extracted from chat data
 */
export interface ChatInfo {
  isGroup: boolean;
  title?: string;
}

/**
 * Response from the unified data endpoint
 */
export interface BeeperDataResponse {
  accounts?: BeeperAccount[];
  messages?: BeeperMessage[];
  archivedMessages?: BeeperMessage[];
  userInfo?: BeeperUserInfo;
  chatInfo?: Record<string, ChatInfo>;
  avatars?: Record<string, string>;
  hasMore?: boolean;
  nextCursor?: string;
  _meta: {
    fetchedAt: string;
    slices: DataSlice[];
  };
}

/**
 * Internal cache entry structure
 */
export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** TTL for accounts cache in milliseconds */
  accountsTtl: number;
  /** TTL for chats/messages cache in milliseconds */
  chatsTtl: number;
}

/**
 * Participant info extracted from chat
 */
export interface ParticipantInfo {
  displayName: string;
  avatarUrl?: string;
  isGroup: boolean;
}
