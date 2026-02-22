'use client';

/**
 * AttentionSummary
 * Shows a badge count for chats needing attention, with a popover
 * listing ranked attention scores. Uses useGlobalAttention hook
 * (pure local scoring, no LLM calls).
 */

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useGlobalAttention } from '@/hooks/use-global-attention';

interface AttentionSummaryProps {
  onSelectChat?: (chatId: string) => void;
}

export function AttentionSummary({ onSelectChat }: AttentionSummaryProps) {
  const { needsAttention, badgeCount, lastUpdated } = useGlobalAttention();

  if (badgeCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors",
            "border border-red-500/20"
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{badgeCount}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Needs Attention</span>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-64">
          <div className="py-1">
            {needsAttention.map((item) => (
              <button
                key={item.chatId}
                className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                onClick={() => onSelectChat?.(item.chatId)}
              >
                <span
                  className={cn(
                    "mt-1 inline-block h-2 w-2 rounded-full shrink-0",
                    item.urgency === 'critical' ? "bg-red-500" : "bg-amber-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">
                      {item.contactName || item.chatId}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.score}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
