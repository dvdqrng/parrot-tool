'use client';

/**
 * Stream of Consciousness
 *
 * A real-time view into what the AI system is thinking and doing.
 * Shows agent thoughts, decisions, observations, and actions as they happen.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Eye,
  Target,
  Zap,
  Send,
  Download,
  Lightbulb,
  FileText,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  subscribeToActivity,
  getRecentActivity,
  getActivityForChat,
  clearActivityLog,
  type ActivityLogEntry,
  type ActivityType,
  type AgentType,
} from '@/lib/intelligence/activity-log';

// ============================================
// HELPERS
// ============================================

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'thought':
      return <Brain className="w-3 h-3" />;
    case 'observation':
      return <Eye className="w-3 h-3" />;
    case 'decision':
      return <Target className="w-3 h-3" />;
    case 'action':
      return <Zap className="w-3 h-3" />;
    case 'api_call':
      return <Send className="w-3 h-3" />;
    case 'api_response':
      return <Download className="w-3 h-3" />;
    case 'knowledge_extract':
      return <Brain className="w-3 h-3" />;
    case 'draft_generated':
      return <FileText className="w-3 h-3" />;
    case 'insight_generated':
      return <Lightbulb className="w-3 h-3" />;
    case 'error':
      return <AlertCircle className="w-3 h-3" />;
    case 'system':
      return <Settings className="w-3 h-3" />;
    default:
      return <Brain className="w-3 h-3" />;
  }
}

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'error':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getAgentLabel(agent: AgentType): string {
  switch (agent) {
    case 'companion':
      return 'AI';
    case 'analyzer':
      return 'Analyzer';
    case 'drafter':
      return 'Drafter';
    case 'knowledge':
      return 'Knowledge';
    case 'style':
      return 'Style';
    case 'proactive':
      return 'Proactive';
    case 'system':
      return 'System';
    default:
      return 'AI';
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

// ============================================
// ACTIVITY ENTRY COMPONENT
// ============================================

function ActivityEntry({ entry }: { entry: ActivityLogEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        'p-2 rounded-lg border text-xs',
        getActivityColor(entry.type)
      )}
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">{getActivityIcon(entry.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="font-medium">{getAgentLabel(entry.agent)}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-50">{formatTime(entry.timestamp)}</span>
            {entry.duration && (
              <>
                <span className="opacity-50">•</span>
                <span className="opacity-50">{entry.duration}ms</span>
              </>
            )}
          </div>
          <p className="break-words">{entry.content}</p>
          {entry.contactName && (
            <p className="opacity-60 mt-0.5">Re: {entry.contactName}</p>
          )}
          {hasDetails && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 mt-1 text-xs opacity-60 hover:opacity-100"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 mr-1" strokeWidth={2} />
              ) : (
                <ChevronDown className="w-3 h-3 mr-1" strokeWidth={2} />
              )}
              {isExpanded ? 'Hide' : 'Details'}
            </Button>
          )}
          <AnimatePresence>
            {isExpanded && hasDetails && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-32"
              >
                {JSON.stringify(entry.details, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface StreamOfConsciousnessProps {
  maxEntries?: number;
  showControls?: boolean;
  compact?: boolean;
  className?: string;
  chatId?: string; // Filter to only show activity for this chat
}

export function StreamOfConsciousness({
  maxEntries = 50,
  showControls = true,
  compact = false,
  className,
  chatId,
}: StreamOfConsciousnessProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial entries (filtered by chatId if provided)
  useEffect(() => {
    const loadEntries = async () => {
      let recent: ActivityLogEntry[];
      console.log('[StreamOfConsciousness] Loading entries for chatId:', chatId);
      if (chatId) {
        recent = await getActivityForChat(chatId, maxEntries);
        console.log('[StreamOfConsciousness] Loaded', recent.length, 'entries for chat');
      } else {
        recent = await getRecentActivity(maxEntries);
        console.log('[StreamOfConsciousness] Loaded', recent.length, 'global entries');
      }
      setEntries(recent.reverse());
    };
    loadEntries();
  }, [maxEntries, chatId]);

  // Subscribe to new entries (filter by chatId if provided)
  useEffect(() => {
    if (isPaused) return;

    console.log('[StreamOfConsciousness] Subscribing to activity, filtering for chatId:', chatId);

    const unsubscribe = subscribeToActivity((entry) => {
      console.log('[StreamOfConsciousness] Received entry:', entry.type, 'chatId:', entry.chatId, 'our chatId:', chatId);

      // If filtering by chatId, only add entries for this chat
      // Also include entries without chatId (system-level entries)
      if (chatId && entry.chatId && entry.chatId !== chatId) {
        console.log('[StreamOfConsciousness] Filtering out entry - chatId mismatch');
        return;
      }

      console.log('[StreamOfConsciousness] Adding entry to stream');
      setEntries((prev) => {
        const updated = [...prev, entry];
        // Keep only last N entries
        if (updated.length > maxEntries) {
          return updated.slice(-maxEntries);
        }
        return updated;
      });
    });

    return unsubscribe;
  }, [isPaused, maxEntries, chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [entries, isPaused]);

  const handleClear = async () => {
    await clearActivityLog();
    setEntries([]);
  };

  if (compact) {
    // Compact mode - just show last few entries inline
    const recentEntries = entries.slice(-3);
    return (
      <div className={cn('space-y-1', className)}>
        <AnimatePresence mode="popLayout">
          {recentEntries.map((entry, i) => (
            <motion.div
              key={entry.id || `${entry.timestamp}-${i}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span className="truncate">{entry.content}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {showControls && (
        <div className="shrink-0 flex items-center justify-between p-2 border-b">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
            <span className="text-xs font-medium">Activity</span>
            <Badge variant="secondary" className="text-xs py-0">
              {entries.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive"
              onClick={handleClear}
            >
              <Trash2 className="w-3 h-3" strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Brain className="w-6 h-6 mx-auto mb-2 opacity-20" strokeWidth={2} />
              <p>No activity yet</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {entries.map((entry, i) => (
                <ActivityEntry
                  key={entry.id || `${entry.timestamp}-${i}`}
                  entry={entry}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {isPaused && (
        <div className="shrink-0 p-2 bg-muted border-t">
          <p className="text-xs text-muted-foreground text-center">
            Paused
          </p>
        </div>
      )}
    </div>
  );
}
