'use client';

/**
 * Global Stream of Consciousness
 *
 * A compact, collapsible view of all AI activity that sits near the bottom navigation.
 * Shows a ticker when collapsed, expands to full stream view on click.
 * Shows the profile picture of the chat recipient the agent is working on.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  subscribeToActivity,
  getRecentActivity,
  clearActivityLog,
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

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return formatTime(timestamp);
}

// ============================================
// HELPERS
// ============================================

function getAvatarSrc(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // file:// URLs need to be proxied through the avatar API
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ============================================
// CHAT AVATAR COMPONENT
// ============================================

function ChatAvatar({ chatId }: { chatId?: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!chatId) return;

    // Get avatar
    const avatars = loadCachedAvatars();
    const rawUrl = avatars[chatId];
    const processedUrl = getAvatarSrc(rawUrl);
    setAvatarUrl(processedUrl || null);

    // Get platform from cached messages
    const messages = loadCachedMessages();
    const chatMessage = messages.find(m => m.chatId === chatId);
    if (chatMessage?.platform) {
      setPlatform(chatMessage.platform);
    }
  }, [chatId]);

  // No chatId = system event, show brain icon
  if (!chatId) {
    return (
      <div className="relative shrink-0">
        <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Brain className="h-3 w-3 text-purple-500" />
        </div>
      </div>
    );
  }

  // Render avatar with platform icon overlay
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
// COMPONENT
// ============================================

interface GlobalStreamProps {
  className?: string;
  maxEntries?: number;
}

export function GlobalStream({ className, maxEntries = 100 }: GlobalStreamProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [latestEntry, setLatestEntry] = useState<ActivityLogEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial entries
  useEffect(() => {
    getRecentActivity(maxEntries).then((recent) => {
      setEntries(recent.reverse());
      if (recent.length > 0) {
        setLatestEntry(recent[recent.length - 1]);
      }
    });
  }, [maxEntries]);

  // Subscribe to new entries
  useEffect(() => {
    if (isPaused && !isExpanded) return;

    const unsubscribe = subscribeToActivity((entry) => {
      setEntries((prev) => {
        const updated = [...prev, entry];
        if (updated.length > maxEntries) {
          return updated.slice(-maxEntries);
        }
        return updated;
      });
      setLatestEntry(entry);
    });

    return unsubscribe;
  }, [isPaused, isExpanded, maxEntries]);

  // Auto-scroll when expanded
  useEffect(() => {
    if (isExpanded && scrollRef.current && !isPaused) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [entries, isExpanded, isPaused]);

  const handleClear = async () => {
    await clearActivityLog();
    setEntries([]);
    setLatestEntry(null);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Collapsed ticker */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-full bg-white dark:bg-card shadow-lg dark:border px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <AnimatePresence mode="wait">
            {latestEntry ? (
              <motion.div
                key={latestEntry.timestamp}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2"
              >
                <ChatAvatar chatId={latestEntry.chatId} />
                <span className={cn('text-xs truncate max-w-[180px]', getActivityColor(latestEntry.type))}>
                  {latestEntry.content}
                </span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Brain className="h-4 w-4 text-purple-500" />
                <span>AI stream...</span>
              </motion.div>
            )}
          </AnimatePresence>
          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
        </motion.div>
      )}

      {/* Expanded panel - opens upward above the ticker */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[380px] bg-white dark:bg-card rounded-lg shadow-xl dark:border overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Stream of Consciousness</span>
                <span className="text-xs text-muted-foreground">
                  ({entries.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? (
                    <Play className="h-3 w-3" />
                  ) : (
                    <Pause className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={handleClear}
                  title="Clear"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsExpanded(false)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Stream */}
            <ScrollArea className="h-[300px]" ref={scrollRef}>
              <div className="p-2 space-y-1">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>No activity yet...</p>
                    <p className="opacity-60">AI thoughts will appear here</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {entries.map((entry, i) => (
                      <motion.div
                        key={entry.id || `${entry.timestamp}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 transition-colors"
                      >
                        <ChatAvatar chatId={entry.chatId} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs', getActivityColor(entry.type))}>
                            {entry.content}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(entry.timestamp)}
                            {entry.contactName && ` • ${entry.contactName}`}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>

            {/* Footer with pause indicator */}
            {isPaused && (
              <div className="px-3 py-1.5 bg-amber-500/10 border-t border-amber-500/20">
                <p className="text-xs text-amber-600 text-center">
                  Stream paused
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
