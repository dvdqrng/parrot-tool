/**
 * Server-side TTL-based cache for Beeper data
 * Reduces redundant API calls to Beeper
 */

import { CacheEntry, CacheConfig } from './types';

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  accountsTtl: 5 * 60 * 1000,  // 5 minutes
  chatsTtl: 30 * 1000,          // 30 seconds
};

/**
 * Simple in-memory cache with TTL support
 */
class BeeperCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key from token hash and data type
   */
  private makeKey(tokenHash: string, dataType: string): string {
    return `${tokenHash}:${dataType}`;
  }

  /**
   * Hash a token for use as cache key (simple hash, not cryptographic)
   */
  hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached data if not expired
   */
  get<T>(tokenHash: string, dataType: string): T | null {
    const key = this.makeKey(tokenHash, dataType);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with appropriate TTL
   */
  set<T>(tokenHash: string, dataType: string, data: T): void {
    const key = this.makeKey(tokenHash, dataType);
    const ttl = dataType === 'accounts' ? this.config.accountsTtl : this.config.chatsTtl;

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(tokenHash: string, dataType: string): void {
    const key = this.makeKey(tokenHash, dataType);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a token
   */
  invalidateAll(tokenHash: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tokenHash}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all expired entries (maintenance)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance for server-side caching
export const beeperCache = new BeeperCache();

// Export class for testing
export { BeeperCache };
