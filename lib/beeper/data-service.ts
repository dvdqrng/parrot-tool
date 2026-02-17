/**
 * BeeperDataService - Core data fetching service
 * Single entry point for all Beeper data operations
 */

import { getBeeperClient, MissingTokenError } from '@/lib/beeper-client';
import { BeeperAccount, BeeperMessage, BeeperUserInfo } from '@/lib/types';
import { beeperCache } from './cache';
import {
  transformAccount,
  transformChatToMessage,
  extractUserInfoFromAccounts,
  extractUserInfoFromChats,
  mergeUserInfo,
} from './transforms';
import {
  DataSlice,
  BeeperDataRequest,
  BeeperDataResponse,
  ChatInfo,
} from './types';

export { MissingTokenError };

/**
 * Main service class for fetching Beeper data
 */
export class BeeperDataService {
  private client: ReturnType<typeof getBeeperClient>;
  private tokenHash: string;

  constructor(beeperToken?: string) {
    this.client = getBeeperClient(beeperToken);
    this.tokenHash = beeperToken ? beeperCache.hashToken(beeperToken) : 'default';
  }

  /**
   * Fetch requested data slices in a single call
   */
  async fetchSlices(request: BeeperDataRequest): Promise<BeeperDataResponse> {
    const response: BeeperDataResponse = {
      _meta: {
        fetchedAt: new Date().toISOString(),
        slices: request.slices,
      },
    };

    // Fetch accounts if requested (and cache)
    if (request.slices.includes('accounts')) {
      response.accounts = await this.fetchAccounts();
    }

    // Fetch messages (includes both regular and archived)
    if (request.slices.includes('messages')) {
      const accountIds = request.accountIds || [];
      const hiddenChatIds = new Set(request.hiddenChatIds || []);

      if (accountIds.length > 0) {
        const result = await this.fetchChatsAndMessages(accountIds, hiddenChatIds, request.cursor);
        response.messages = result.messages;
        response.archivedMessages = result.archivedMessages;
        response.chatInfo = result.chatInfo;
        response.avatars = result.avatars;
        response.hasMore = result.hasMore;
        response.nextCursor = result.nextCursor;
      } else {
        response.messages = [];
        response.archivedMessages = [];
        response.chatInfo = {};
        response.avatars = {};
        response.hasMore = false;
        response.nextCursor = undefined;
      }
    }

    // Fetch user info if requested
    if (request.slices.includes('userInfo')) {
      response.userInfo = await this.fetchUserInfo();
    }

    return response;
  }

  /**
   * Fetch accounts (with caching)
   */
  private async fetchAccounts(): Promise<BeeperAccount[]> {
    // Check cache first
    const cached = beeperCache.get<BeeperAccount[]>(this.tokenHash, 'accounts');
    if (cached) return cached;

    // Fetch from API
    const accountsArray = await this.client.accounts.list();
    const accounts = accountsArray.map(transformAccount);

    // Cache the result
    beeperCache.set(this.tokenHash, 'accounts', accounts);

    return accounts;
  }

  /**
   * Fetch chats and messages (regular + archived together)
   */
  private async fetchChatsAndMessages(
    accountIds: string[],
    hiddenChatIds: Set<string>,
    cursor?: string
  ): Promise<{
    messages: BeeperMessage[];
    archivedMessages: BeeperMessage[];
    chatInfo: Record<string, ChatInfo>;
    avatars: Record<string, string>;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    const messages: BeeperMessage[] = [];
    const archivedMessages: BeeperMessage[] = [];
    const chatInfo: Record<string, ChatInfo> = {};
    const avatars: Record<string, string> = {};

    let nextCursor: string | undefined;
    let chatCount = 0;

    // Fetch regular chats
    const chatListParams: { accountIDs: string[]; cursor?: string } = {
      accountIDs: accountIds,
    };
    if (cursor) {
      chatListParams.cursor = cursor;
    }

    for await (const chat of this.client.chats.list(chatListParams)) {
      // Skip hidden chats
      if (hiddenChatIds.has(chat.id)) continue;

      // Skip archived chats (we fetch them separately)
      if (chat.isArchived) continue;

      const preview = chat.preview;
      const isFromMe = preview?.isSender || false;
      const hasUnread = chat.unreadCount > 0;

      // Skip chats that have no unread messages AND aren't from me
      if (!hasUnread && !isFromMe) continue;

      const result = transformChatToMessage(chat);

      messages.push(result.message);
      chatInfo[chat.id] = result.chatInfo;
      if (result.avatarUrl) {
        avatars[chat.id] = result.avatarUrl;
      }

      chatCount++;
      nextCursor = chat.id;

      // Limit results per page
      if (chatCount >= 500) break;
    }

    const hasMore = chatCount === 500;

    // Fetch archived chats (limit to 20)
    let archivedCount = 0;
    for await (const chat of this.client.chats.search({
      accountIDs: accountIds,
      inbox: 'archive',
    })) {
      const result = transformChatToMessage(chat, { isArchived: true });

      archivedMessages.push(result.message);
      chatInfo[chat.id] = result.chatInfo;
      if (result.avatarUrl) {
        avatars[chat.id] = result.avatarUrl;
      }

      archivedCount++;
      if (archivedCount >= 20) break;
    }

    return {
      messages,
      archivedMessages,
      chatInfo,
      avatars,
      hasMore,
      nextCursor: hasMore ? nextCursor : undefined,
    };
  }

  /**
   * Fetch user info (from accounts + chats fallback)
   */
  private async fetchUserInfo(): Promise<BeeperUserInfo> {
    // Check cache first
    const cached = beeperCache.get<BeeperUserInfo>(this.tokenHash, 'userInfo');
    if (cached && cached.name && cached.avatarUrl) return cached;

    // Try to get from accounts first
    const accounts = await this.client.accounts.list();
    const accountUserInfo = extractUserInfoFromAccounts(accounts);

    // If we have both name and avatar, cache and return
    if (accountUserInfo.name && accountUserInfo.avatarUrl) {
      beeperCache.set(this.tokenHash, 'userInfo', accountUserInfo);
      return accountUserInfo;
    }

    // Fallback: look through chats
    const chats: Array<{
      participants?: {
        items?: Array<{
          isSelf?: boolean;
          fullName?: string;
          username?: string;
          imgURL?: string;
        }>;
      };
    }> = [];

    let chatsChecked = 0;
    for await (const chat of this.client.chats.list()) {
      chats.push(chat);
      chatsChecked++;
      if (chatsChecked >= 50) break;
    }

    const chatUserInfo = extractUserInfoFromChats(chats);
    const mergedInfo = mergeUserInfo(accountUserInfo, chatUserInfo);

    // Cache the result
    beeperCache.set(this.tokenHash, 'userInfo', mergedInfo);

    return mergedInfo;
  }

  /**
   * Invalidate all cached data for this token
   */
  invalidateCache(): void {
    beeperCache.invalidateAll(this.tokenHash);
  }
}

/**
 * Create a new data service instance
 */
export function createDataService(beeperToken?: string): BeeperDataService {
  return new BeeperDataService(beeperToken);
}
