'use client';

/**
 * Global Stream of Consciousness
 *
 * A stacked card notification view of all AI activity that sits near the bottom navigation.
 * Shows a stack of the latest cards when collapsed, expands to full scrollable card list on click.
 * Shows the profile picture of the chat recipient the agent is working on.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  subscribeToActivity,
  getRecentActivity,
  type ActivityLogEntry,
  type ActivityType,
} from '@/lib/intelligence/activity-log';
import { loadCachedAvatars, loadCachedMessages } from '@/lib/storage';
import { PlatformIcon } from '@/components/platform-icon';

// ============================================
// HELPERS
// ============================================

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'thought':
      return 'text-violet-600 dark:text-violet-400';
    case 'observation':
      return 'text-blue-600 dark:text-blue-400';
    case 'decision':
      return 'text-amber-600 dark:text-amber-400';
    case 'action':
      return 'text-green-600 dark:text-green-400';
    case 'api_call':
    case 'api_response':
      return 'text-gray-600 dark:text-gray-400';
    case 'knowledge_extract':
      return 'text-purple-600 dark:text-purple-400';
    case 'draft_generated':
      return 'text-cyan-600 dark:text-cyan-400';
    case 'insight_generated':
      return 'text-pink-600 dark:text-pink-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'system':
      return 'text-slate-600 dark:text-slate-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

function getActivityDotColor(type: ActivityType): string {
  switch (type) {
    case 'thought':
      return 'bg-violet-500';
    case 'observation':
      return 'bg-blue-500';
    case 'decision':
      return 'bg-amber-500';
    case 'action':
      return 'bg-green-500';
    case 'api_call':
    case 'api_response':
      return 'bg-gray-400';
    case 'knowledge_extract':
      return 'bg-purple-500';
    case 'draft_generated':
      return 'bg-cyan-500';
    case 'insight_generated':
      return 'bg-pink-500';
    case 'error':
      return 'bg-red-500';
    case 'system':
      return 'bg-slate-400';
    default:
      return 'bg-gray-400';
  }
}

function getAvatarSrc(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ============================================
// STACK CONSTANTS
// ============================================

const STACK_SIZE = 3;

const STACK_OFFSETS = [
  { y: 0, scale: 1.0, opacity: 1.0 },
  { y: 6, scale: 0.97, opacity: 0.7 },
  { y: 12, scale: 0.94, opacity: 0.4 },
];

// ============================================
// CHAT AVATAR COMPONENT
// ============================================

function ChatAvatar({ chatId }: { chatId?: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!chatId) return;

    const avatars = loadCachedAvatars();
    const rawUrl = avatars[chatId];
    const processedUrl = getAvatarSrc(rawUrl);
    setAvatarUrl(processedUrl || null);

    const messages = loadCachedMessages();
    const chatMessage = messages.find(m => m.chatId === chatId);
    if (chatMessage?.platform) {
      setPlatform(chatMessage.platform);
    }
  }, [chatId]);

  if (!chatId) {
    return (
      <div className="relative shrink-0">
        <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Brain className="h-3 w-3 text-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">?</span>
        </div>
      )}
      {platform && (
        <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
          <PlatformIcon platform={platform} className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY CARD COMPONENT
// ============================================

const CARD_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

function ActivityCard({ entry }: { entry: ActivityLogEntry }) {
  return (
    <div className="w-[200px] rounded-lg px-2 py-1.5 bg-white dark:bg-card shadow-md dark:border">
      <div className="flex items-center gap-1.5">
        <ChatAvatar chatId={entry.chatId} />
        <p className={cn(
          'flex-1 min-w-0 truncate leading-tight text-[10px]',
          getActivityColor(entry.type),
        )}>
          {entry.content}
        </p>
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            getActivityDotColor(entry.type),
          )}
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface GlobalStreamProps {
  className?: string;
  maxEntries?: number;
}

export function GlobalStream({ className, maxEntries = 100 }: GlobalStreamProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load initial entries
  useEffect(() => {
    getRecentActivity(maxEntries).then((recent) => {
      setEntries(recent.reverse());
    });
  }, [maxEntries]);

  // Subscribe to new entries
  useEffect(() => {
    const unsubscribe = subscribeToActivity((entry) => {
      setEntries((prev) => {
        const updated = [...prev, entry];
        if (updated.length > maxEntries) {
          return updated.slice(-maxEntries);
        }
        return updated;
      });
    });

    return unsubscribe;
  }, [maxEntries]);

  // Scroll to bottom when expanded list mounts
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, []);

  // In collapsed mode, only the last STACK_SIZE entries are visible
  const visibleStart = isExpanded ? 0 : Math.max(0, entries.length - STACK_SIZE);

  return (
    <div
      className={cn('flex flex-col items-center justify-end cursor-pointer', className)}
      onClick={() => setIsExpanded((v) => !v)}
      role="button"
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} AI activity stream`}
    >
      {entries.length === 0 ? (
        <div className="w-[200px] rounded-lg bg-white dark:bg-card shadow-md dark:border px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-purple-500" />
          <span>AI stream...</span>
        </div>
      ) : (
        <div className="relative w-[200px]">
          {/* Top fade gradient (only when expanded & scrollable) */}
          {isExpanded && entries.length > 5 && (
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-background to-transparent z-10" />
          )}

          <div
            ref={isExpanded ? scrollRef : undefined}
            className={cn(
              'flex flex-col items-center gap-1.5',
              isExpanded && 'max-h-[300px] overflow-y-auto py-1',
            )}
            style={isExpanded ? { scrollbarWidth: 'none' } : undefined}
          >
            {entries.map((entry, i) => {
              const isVisible = i >= visibleStart;
              // In collapsed mode: depth from the newest (last visible = 0, earlier = 1, 2)
              const depth = !isExpanded ? (entries.length - 1 - i) : 0;
              const stackOffset = !isExpanded && isVisible ? STACK_OFFSETS[depth] : undefined;

              return (
                <motion.div
                  key={entry.id || `${entry.timestamp}-${i}`}
                  layout
                  transition={CARD_SPRING}
                  animate={{
                    opacity: !isVisible ? 0 : (stackOffset?.opacity ?? 1),
                    scale: stackOffset?.scale ?? 1,
                    y: !isExpanded && isVisible ? -(stackOffset?.y ?? 0) : 0,
                  }}
                  style={{
                    zIndex: i,
                    // In collapsed mode, stack cards on top of each other
                    ...(!isExpanded ? {
                      position: 'absolute' as const,
                      bottom: 0,
                      left: 0,
                      width: '100%',
                    } : {}),
                    // Hide non-visible cards in collapsed mode
                    ...(!isVisible ? {
                      pointerEvents: 'none' as const,
                      position: 'absolute' as const,
                      bottom: 0,
                      left: 0,
                      width: '100%',
                    } : {}),
                  }}
                >
                  <ActivityCard entry={entry} />
                </motion.div>
              );
            })}
          </div>

          {/* Reserve space for collapsed stack */}
          {!isExpanded && <div style={{ height: 48 }} />}
        </div>
      )}
    </div>
  );
}
