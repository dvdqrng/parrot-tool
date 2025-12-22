import { logger } from './logger';

/**
 * Generic LocalStorage manager to eliminate repetitive patterns
 *
 * Usage:
 *   const draftsManager = new StorageManager('beeper-kanban-drafts', []);
 *   const drafts = draftsManager.load();
 *   draftsManager.save(updatedDrafts);
 */
export class StorageManager<T> {
  constructor(
    private readonly key: string,
    private readonly defaultValue: T,
    private readonly debugName?: string
  ) {}

  /**
   * Check if we're in a server environment
   */
  private isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Load data from localStorage with error handling
   */
  load(): T {
    if (this.isServer()) {
      return this.defaultValue;
    }

    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) {
        return this.defaultValue;
      }
      return JSON.parse(stored) as T;
    } catch (error) {
      logger.error(`Failed to load ${this.debugName || this.key} from localStorage`, error instanceof Error ? error : String(error));
      return this.defaultValue;
    }
  }

  /**
   * Save data to localStorage with error handling
   */
  save(value: T): boolean {
    if (this.isServer()) {
      return false;
    }

    try {
      localStorage.setItem(this.key, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Failed to save ${this.debugName || this.key} to localStorage`, error instanceof Error ? error : String(error));
      return false;
    }
  }

  /**
   * Clear data from localStorage
   */
  clear(): void {
    if (this.isServer()) {
      return;
    }

    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      logger.error(`Failed to clear ${this.debugName || this.key} from localStorage`, error instanceof Error ? error : String(error));
    }
  }

  /**
   * Update data with a transformation function
   * Useful for partial updates
   */
  update(updater: (current: T) => T): T {
    const current = this.load();
    const updated = updater(current);
    this.save(updated);
    return updated;
  }

  /**
   * Check if key exists in localStorage
   */
  exists(): boolean {
    if (this.isServer()) {
      return false;
    }

    return localStorage.getItem(this.key) !== null;
  }
}

/**
 * Specialized manager for Set-based storage
 */
export class SetStorageManager<T> {
  private manager: StorageManager<T[]>;

  constructor(
    key: string,
    debugName?: string
  ) {
    this.manager = new StorageManager<T[]>(key, [], debugName);
  }

  load(): Set<T> {
    const array = this.manager.load();
    return new Set(array);
  }

  save(set: Set<T>): boolean {
    return this.manager.save(Array.from(set));
  }

  add(item: T): Set<T> {
    const set = this.load();
    set.add(item);
    this.save(set);
    return set;
  }

  delete(item: T): Set<T> {
    const set = this.load();
    set.delete(item);
    this.save(set);
    return set;
  }

  has(item: T): boolean {
    const set = this.load();
    return set.has(item);
  }

  clear(): void {
    this.manager.clear();
  }
}

/**
 * Specialized manager for Record/Map-based storage
 */
export class MapStorageManager<K extends string, V> {
  private manager: StorageManager<Record<K, V>>;

  constructor(
    key: string,
    debugName?: string
  ) {
    this.manager = new StorageManager<Record<K, V>>(key, {} as Record<K, V>, debugName);
  }

  load(): Record<K, V> {
    return this.manager.load();
  }

  save(record: Record<K, V>): boolean {
    return this.manager.save(record);
  }

  get(key: K): V | undefined {
    const record = this.load();
    return record[key];
  }

  set(key: K, value: V): Record<K, V> {
    return this.manager.update(current => ({
      ...current,
      [key]: value,
    }));
  }

  delete(key: K): Record<K, V> {
    return this.manager.update(current => {
      const updated = { ...current };
      delete updated[key];
      return updated;
    });
  }

  merge(newData: Partial<Record<K, V>>): Record<K, V> {
    return this.manager.update(current => ({
      ...current,
      ...newData,
    }));
  }

  has(key: K): boolean {
    const record = this.load();
    return key in record;
  }

  clear(): void {
    this.manager.clear();
  }
}

/**
 * Helper to create timestamp-tracked storage
 */
export class TimestampedStorageManager<T> extends StorageManager<T> {
  private timestampKey: string;

  constructor(
    key: string,
    defaultValue: T,
    debugName?: string
  ) {
    super(key, defaultValue, debugName);
    this.timestampKey = `${key}-timestamp`;
  }

  save(value: T): boolean {
    const success = super.save(value);
    if (success) {
      try {
        localStorage.setItem(this.timestampKey, Date.now().toString());
      } catch {
        // Timestamp is optional, don't fail the save
      }
    }
    return success;
  }

  getTimestamp(): number | null {
    try {
      const stored = localStorage.getItem(this.timestampKey);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  }

  isStale(maxAgeMs: number): boolean {
    const timestamp = this.getTimestamp();
    if (!timestamp) return true;
    return Date.now() - timestamp > maxAgeMs;
  }
}
