'use client';

import { Loader2, Clock, Send, Eye, Lightbulb, PenLine, ListStart, BookOpen, CheckCircle } from 'lucide-react';
import { AutopilotStatus, AutopilotMode, AutopilotActivityEntry } from '@/lib/types';
import { SchedulerStatus, formatCountdown } from '@/hooks/use-scheduler-status';
import { cn } from '@/lib/utils';

interface AutopilotCurrentActivityProps {
  status: AutopilotStatus;
  mode: AutopilotMode;
  lastActivity: AutopilotActivityEntry | null;
  errorMessage?: string;
  schedulerStatus?: SchedulerStatus;
}

export function AutopilotCurrentActivity({
  status,
  mode,
  lastActivity,
  errorMessage,
  schedulerStatus,
}: AutopilotCurrentActivityProps) {
  // Determine what to show based on status, last activity, and scheduler state
  const getActivityDisplay = () => {
    // Handle non-active statuses first
    if (status === 'paused') {
      return { text: 'Paused', color: 'text-muted-foreground', icon: null };
    }

    if (status === 'error') {
      return { text: errorMessage || 'An error occurred', color: 'text-red-500', icon: null };
    }

    if (status === 'goal-completed') {
      return { text: 'Goal achieved', color: 'text-green-500', icon: null };
    }

    // For active status, combine scheduler state + last activity
    if (status === 'active') {
      const timeSinceLastActivity = lastActivity
        ? Date.now() - new Date(lastActivity.timestamp).getTime()
        : Infinity;

      // Check scheduler state first for most accurate status
      // Skip for observer and suggest modes — they never schedule sends
      if (schedulerStatus && mode !== 'observer' && mode !== 'suggest') {
        const { phase, secondsUntilNextAction, chatPendingActions, chatExecutingAction } = schedulerStatus;

        // Currently executing
        if (chatExecutingAction || phase === 'executing') {
          return {
            text: 'Sending message...',
            color: 'text-blue-500',
            icon: <Send className="h-3 w-3" strokeWidth={2} />,
            showSpinner: true,
          };
        }

        // Has pending actions scheduled
        if (chatPendingActions.length > 0 && secondsUntilNextAction !== null) {
          // Manual approval mode (far future = 24 hours)
          if (secondsUntilNextAction > 60 * 60) {
            return {
              text: 'Draft ready for approval',
              color: 'text-amber-500',
              icon: <ListStart className="h-3 w-3 rotate-180" strokeWidth={2} />,
            };
          }

          // Countdown to send
          const countdown = formatCountdown(secondsUntilNextAction);
          const queueText = chatPendingActions.length > 1
            ? ` (${chatPendingActions.length} queued)`
            : '';

          return {
            text: `Sending in ${countdown}${queueText}`,
            color: 'text-blue-500',
            icon: <Clock className="h-3 w-3" strokeWidth={2} />,
          };
        }
      }

      // Fall back to activity-based status
      if (lastActivity) {
        // Observer mode: only show observer-relevant activities
        if (mode === 'observer') {
          switch (lastActivity.type) {
            case 'history-loading': {
              const count = lastActivity.metadata?.messagesProcessed as number | undefined;
              return {
                text: count ? `Processing history... ${count} messages` : 'Loading history...',
                color: 'text-muted-foreground',
                icon: <BookOpen className="h-3 w-3" strokeWidth={2} />,
                showSpinner: true,
              };
            }
            case 'history-complete':
              return {
                text: 'Knowledge up to date',
                color: 'text-muted-foreground',
                icon: <CheckCircle className="h-3 w-3" strokeWidth={2} />,
              };
            case 'knowledge-updated':
              if (timeSinceLastActivity < 5000) {
                return {
                  text: 'Knowledge updated',
                  color: 'text-muted-foreground',
                  icon: <BookOpen className="h-3 w-3" strokeWidth={2} />,
                };
              }
              break;
          }
          // For any other activity type in observer mode, fall through to default
        } else {
          // Non-observer modes: show all activity types
          switch (lastActivity.type) {
            case 'message-received':
              if (timeSinceLastActivity < 3000) {
                return {
                  text: 'Reading message...',
                  color: 'text-muted-foreground',
                  icon: <Eye className="h-3 w-3" strokeWidth={2} />,
                  showSpinner: true,
                };
              }
              return {
                text: 'Composing reply...',
                color: 'text-muted-foreground',
                icon: <PenLine className="h-3 w-3" strokeWidth={2} />,
                showSpinner: true,
              };

            case 'draft-generated':
              if (mode === 'suggest') {
                return {
                  text: 'New suggestion available',
                  color: 'text-amber-500',
                  icon: <Lightbulb className="h-3 w-3" strokeWidth={2} />,
                };
              }
              if (mode === 'manual-approval') {
                return {
                  text: 'Draft ready for approval',
                  color: 'text-amber-500',
                  icon: <ListStart className="h-3 w-3 rotate-180" strokeWidth={2} />,
                };
              }
              return {
                text: 'Scheduling send...',
                color: 'text-muted-foreground',
                icon: <Clock className="h-3 w-3" strokeWidth={2} />,
                showSpinner: true,
              };

            case 'message-sent':
              if (timeSinceLastActivity < 5000) {
                return {
                  text: 'Message sent',
                  color: 'text-green-500',
                  icon: <Send className="h-3 w-3" strokeWidth={2} />,
                };
              }
              return {
                text: 'Waiting for messages...',
                color: 'text-muted-foreground',
                icon: null,
              };

            case 'goal-detected':
              return {
                text: 'Goal detected',
                color: 'text-green-500',
                icon: null,
              };

            case 'skipped-busy':
              if (timeSinceLastActivity < 10000) {
                return {
                  text: 'Skipped (simulating busy)',
                  color: 'text-amber-500',
                  icon: null,
                };
              }
              break;

            case 'emoji-only-sent':
              if (timeSinceLastActivity < 5000) {
                return {
                  text: 'Sent emoji reaction',
                  color: 'text-muted-foreground',
                  icon: null,
                };
              }
              break;

            case 'fatigue-reduced':
              return {
                text: 'Engagement reduced (fatigue)',
                color: 'text-amber-500',
                icon: null,
              };

            case 'conversation-closing':
              return {
                text: 'Suggesting to wrap up',
                color: 'text-muted-foreground',
                icon: null,
              };

            case 'history-loading': {
              const count = lastActivity.metadata?.messagesProcessed as number | undefined;
              return {
                text: count ? `Processing history... ${count} messages` : 'Loading history...',
                color: 'text-muted-foreground',
                icon: <BookOpen className="h-3 w-3" strokeWidth={2} />,
                showSpinner: true,
              };
            }

            case 'history-complete':
              return {
                text: 'Knowledge up to date',
                color: 'text-muted-foreground',
                icon: <CheckCircle className="h-3 w-3" strokeWidth={2} />,
              };

            case 'knowledge-updated': {
              if (timeSinceLastActivity < 5000) {
                return {
                  text: 'Knowledge updated',
                  color: 'text-muted-foreground',
                  icon: <BookOpen className="h-3 w-3" strokeWidth={2} />,
                };
              }
              break;
            }
          }
        }
      }

      // Default for active with no relevant activity
      if (mode === 'observer') {
        return {
          text: 'Observing',
          color: 'text-muted-foreground',
          icon: <Eye className="h-3 w-3" strokeWidth={2} />,
        };
      }

      if (mode === 'suggest') {
        return {
          text: 'Listening for messages...',
          color: 'text-muted-foreground',
          icon: <Lightbulb className="h-3 w-3" strokeWidth={2} />,
        };
      }

      return {
        text: 'Waiting for messages...',
        color: 'text-muted-foreground',
        icon: null,
      };
    }

    // Default fallback
    return {
      text: 'Waiting for messages...',
      color: 'text-muted-foreground',
      icon: null,
    };
  };

  const display = getActivityDisplay();

  return (
    <div className="flex items-center gap-1.5">
      {display.showSpinner ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" strokeWidth={2} />
      ) : display.icon ? (
        <span className={cn(display.color)}>{display.icon}</span>
      ) : null}
      <p className={cn('text-xs', display.color)}>
        {display.text}
      </p>
    </div>
  );
}
