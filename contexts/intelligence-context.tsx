'use client';

/**
 * Intelligence Context Provider
 * Provides access to the intelligence layer throughout the app
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useBeeperData } from '@/hooks/use-beeper-data';
import {
  ContactIntelligence,
} from '@/lib/intelligence/knowledge/types';
import {
  UserIntelligence,
  createDefaultUserIntelligence,
} from '@/lib/intelligence/user-state/types';
import {
  contactStore,
  userStateStore,
  extractionQueueStore,
} from '@/lib/intelligence/knowledge/store';
import { syncCrmToIntelligence } from '@/lib/intelligence/knowledge/crm-bridge';
import { extractTier1, Tier1ExtractionResult } from '@/lib/intelligence/extraction/tier1-local';
import { processAmbientStream } from '@/lib/intelligence/user-state/ambient-processor';
import { getStyleModel } from '@/lib/intelligence/style/model';
import {
  startIntelligenceWorker,
  stopIntelligenceWorker,
  getWorkerStatus,
} from '@/lib/intelligence/background-worker';
import { eventBus } from '@/lib/intelligence/event-bus';

// ============================================
// CONTEXT TYPES
// ============================================

interface IntelligenceContextValue {
  // Initialization state
  isInitialized: boolean;
  isProcessing: boolean;

  // Contact intelligence
  getContactIntelligence: (chatId: string) => Promise<ContactIntelligence | null>;
  getAllContacts: () => Promise<ContactIntelligence[]>;

  // User state
  userState: UserIntelligence | null;
  refreshUserState: () => Promise<void>;

  // Extraction
  triggerExtraction: (chatId: string) => Promise<void>;
  extractionQueueSize: number;

  // Stats
  stats: {
    contactCount: number;
    factCount: number;
    activeContextCount: number;
  };

  // Background worker status
  workerStatus: {
    isRunning: boolean;
    tickCount: number;
    activeChats: number;
  };

  // Manual refresh
  refresh: () => Promise<void>;
}

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface IntelligenceProviderProps {
  children: ReactNode;
}

export function IntelligenceProvider({ children }: IntelligenceProviderProps) {
  const { messages, sentMessages } = useBeeperData();

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userState, setUserState] = useState<UserIntelligence | null>(null);
  const [extractionQueueSize, setExtractionQueueSize] = useState(0);
  const [stats, setStats] = useState({
    contactCount: 0,
    factCount: 0,
    activeContextCount: 0,
  });
  const [workerStatus, setWorkerStatus] = useState({
    isRunning: false,
    tickCount: 0,
    activeChats: 0,
  });

  // Refs
  const processedMessageIds = useRef(new Set<string>());
  const lastAmbientProcessing = useRef(0);
  const isInitializing = useRef(false);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInitialized || isInitializing.current) return;

    isInitializing.current = true;

    async function init() {
      try {
        // Sync CRM contacts to intelligence store
        await syncCrmToIntelligence();

        // Load user state
        const state = await userStateStore.get();
        setUserState(state || createDefaultUserIntelligence());

        // Load style model from store
        await getStyleModel().loadFromStore();

        // Get initial stats
        await updateStats();

        setIsInitialized(true);

        // Start the background worker (the "heartbeat")
        console.log('[IntelligenceProvider] Starting background worker...');
        startIntelligenceWorker();

      } catch (error) {
        console.error('Intelligence initialization failed:', error);
        setIsInitialized(true); // Still mark as initialized to allow UI to render
      } finally {
        isInitializing.current = false;
      }
    }

    init();

    // Cleanup: stop worker on unmount
    return () => {
      console.log('[IntelligenceProvider] Stopping background worker...');
      stopIntelligenceWorker();
    };
  }, [isInitialized]);

  // Subscribe to worker status updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Update worker status on each tick
    const unsubscribe = eventBus.on('worker_tick', () => {
      const status = getWorkerStatus();
      setWorkerStatus({
        isRunning: status.isRunning,
        tickCount: status.tickCount,
        activeChats: status.activeChats,
      });
    });

    // Also update on start/stop
    const unsubStart = eventBus.on('worker_started', () => {
      const status = getWorkerStatus();
      setWorkerStatus({
        isRunning: status.isRunning,
        tickCount: status.tickCount,
        activeChats: status.activeChats,
      });
    });

    const unsubStop = eventBus.on('worker_stopped', () => {
      setWorkerStatus({
        isRunning: false,
        tickCount: 0,
        activeChats: 0,
      });
    });

    return () => {
      unsubscribe();
      unsubStart();
      unsubStop();
    };
  }, []);

  // ============================================
  // MESSAGE PROCESSING
  // ============================================

  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    // Process new messages with Tier 1 extraction
    const newMessages = messages.filter(
      m => !processedMessageIds.current.has(m.id)
    );

    if (newMessages.length === 0) return;

    // Mark as processed
    for (const msg of newMessages) {
      processedMessageIds.current.add(msg.id);
    }

    // Run Tier 1 extraction (synchronous, free)
    const tier1Results: Tier1ExtractionResult[] = [];
    for (const msg of newMessages) {
      const result = extractTier1(msg);
      tier1Results.push(result);

      // Store basic extracted info (URLs, dates, etc.)
      // This could queue for Tier 2 if interesting facts are detected
      if (
        result.emails.length > 0 ||
        result.phones.length > 0 ||
        result.dates.length > 0
      ) {
        // Queue for Tier 2 extraction
        extractionQueueStore.add({
          chatId: msg.chatId,
          contactId: '',
          messageIds: [msg.id],
          priority: 'normal',
          scheduledFor: new Date(Date.now() + 30000).toISOString(), // 30s delay
        }).then(() => {
          extractionQueueStore.count().then(setExtractionQueueSize);
        });
      }
    }
  }, [messages, isInitialized]);

  // ============================================
  // AMBIENT PROCESSING
  // ============================================

  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;
    if (sentMessages.length === 0) return;

    // Only process every 5 minutes
    const now = Date.now();
    if (now - lastAmbientProcessing.current < 5 * 60 * 1000) return;

    lastAmbientProcessing.current = now;

    async function processAmbient() {
      setIsProcessing(true);
      try {
        const updates = await processAmbientStream(sentMessages);

        if (Object.keys(updates).length > 0) {
          await userStateStore.update(updates);
          const newState = await userStateStore.get();
          setUserState(newState || null);
        }
      } catch (error) {
        console.error('Ambient processing failed:', error);
      } finally {
        setIsProcessing(false);
      }
    }

    processAmbient();
  }, [sentMessages, isInitialized]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const updateStats = async () => {
    try {
      const contacts = await contactStore.getAll();
      const factCount = contacts.reduce(
        (sum, c) => sum + (c.facts?.length || 0),
        0
      );
      const state = await userStateStore.get();

      setStats({
        contactCount: contacts.length,
        factCount,
        activeContextCount: state?.activeContexts?.length || 0,
      });
    } catch {
      // Ignore errors
    }
  };

  // ============================================
  // EXPOSED FUNCTIONS
  // ============================================

  const getContactIntelligence = useCallback(
    async (chatId: string): Promise<ContactIntelligence | null> => {
      if (typeof window === 'undefined') return null;
      try {
        const contact = await contactStore.getByChatId(chatId);
        return contact || null;
      } catch {
        return null;
      }
    },
    []
  );

  const getAllContacts = useCallback(async (): Promise<ContactIntelligence[]> => {
    if (typeof window === 'undefined') return [];
    try {
      return await contactStore.getAll();
    } catch {
      return [];
    }
  }, []);

  const refreshUserState = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      // Force ambient processing
      if (sentMessages.length > 0) {
        const updates = await processAmbientStream(sentMessages);
        await userStateStore.update(updates);
      }
      const state = await userStateStore.get();
      setUserState(state || null);
    } catch (error) {
      console.error('Failed to refresh user state:', error);
    }
  }, [sentMessages]);

  const triggerExtraction = useCallback(async (chatId: string) => {
    if (typeof window === 'undefined') return;
    try {
      await extractionQueueStore.add({
        chatId,
        contactId: '',
        messageIds: [],
        priority: 'high',
        scheduledFor: new Date().toISOString(),
      });
      const count = await extractionQueueStore.count();
      setExtractionQueueSize(count);
    } catch (error) {
      console.error('Failed to trigger extraction:', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await syncCrmToIntelligence();
      await refreshUserState();
      await updateStats();
    } catch (error) {
      console.error('Failed to refresh intelligence:', error);
    }
  }, [refreshUserState]);

  // ============================================
  // RENDER
  // ============================================

  const value: IntelligenceContextValue = {
    isInitialized,
    isProcessing,
    getContactIntelligence,
    getAllContacts,
    userState,
    refreshUserState,
    triggerExtraction,
    extractionQueueSize,
    stats,
    workerStatus,
    refresh,
  };

  return (
    <IntelligenceContext.Provider value={value}>
      {children}
    </IntelligenceContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useIntelligence(): IntelligenceContextValue {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within IntelligenceProvider');
  }
  return context;
}
