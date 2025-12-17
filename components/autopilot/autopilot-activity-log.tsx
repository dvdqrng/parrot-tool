'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Sparkles,
  Send,
  MessageCircle,
  Target,
  Pause,
  Play,
  AlertTriangle,
  Clock,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AutopilotActivityEntry } from '@/lib/types';
import { loadAutopilotActivity } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface AutopilotActivityLogProps {
  chatId: string;
}

export function AutopilotActivityLog({ chatId }: AutopilotActivityLogProps) {
  const [activities, setActivities] = useState<AutopilotActivityEntry[]>([]);

  // Load and filter activities for this chat
  useEffect(() => {
    const loadActivities = () => {
      const allActivities = loadAutopilotActivity();
      const filtered = allActivities
        .filter((a) => a.chatId === chatId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(filtered);
    };

    loadActivities();

    // Poll for updates every 2 seconds
    const interval = setInterval(loadActivities, 2000);
    return () => clearInterval(interval);
  }, [chatId]);

  const getActivityIcon = (type: string): LucideIcon => {
    switch (type) {
      case 'message-received':
        return MessageCircle;
      case 'draft-generated':
        return Sparkles;
      case 'message-sent':
        return Send;
      case 'goal-detected':
        return Target;
      case 'paused':
        return Pause;
      case 'resumed':
        return Play;
      case 'error':
        return AlertTriangle;
      case 'time-expired':
        return Clock;
      case 'mode-changed':
      case 'agent-changed':
        return Settings;
      default:
        return MessageCircle;
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'message-received':
        return 'text-blue-500';
      case 'draft-generated':
        return 'text-purple-500';
      case 'message-sent':
        return 'text-green-500';
      case 'goal-detected':
        return 'text-emerald-500';
      case 'error':
        return 'text-red-500';
      case 'paused':
        return 'text-yellow-500';
      case 'resumed':
        return 'text-green-500';
      case 'time-expired':
        return 'text-orange-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getActivityDescription = (activity: AutopilotActivityEntry): string => {
    switch (activity.type) {
      case 'message-received':
        return activity.messageText
          ? `Message received: "${activity.messageText.slice(0, 50)}${activity.messageText.length > 50 ? '...' : ''}"`
          : 'Message received';
      case 'draft-generated':
        return 'Draft generated';
      case 'message-sent':
        return activity.messageText
          ? `Message sent: "${activity.messageText.slice(0, 50)}${activity.messageText.length > 50 ? '...' : ''}"`
          : 'Message sent';
      case 'goal-detected':
        return 'Goal achievement detected';
      case 'paused':
        return 'Autopilot paused';
      case 'resumed':
        return 'Autopilot resumed';
      case 'error':
        return `Error: ${activity.errorMessage || 'Unknown error'}`;
      case 'time-expired':
        return 'Self-driving time expired';
      case 'mode-changed':
        return 'Mode changed';
      case 'agent-changed':
        return 'Agent changed';
      case 'handoff-triggered':
        return 'Handoff triggered';
      default:
        return activity.type;
    }
  };

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[180px] pr-4">
      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);
          const description = getActivityDescription(activity);

          return (
            <div
              key={activity.id}
              className="flex items-start gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
            >
              <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', color)} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-foreground break-words">{description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
