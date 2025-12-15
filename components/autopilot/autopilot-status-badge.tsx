'use client';

import { Brain, Pause, AlertCircle, CheckCircle, LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AutopilotStatus, AutopilotMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AutopilotStatusBadgeProps {
  status: AutopilotStatus;
  mode?: AutopilotMode;
  agentName?: string;
  timeRemaining?: number | null;
  className?: string;
  showLabel?: boolean;
}

export function AutopilotStatusBadge({
  status,
  mode,
  agentName,
  timeRemaining,
  className,
  showLabel = false,
}: AutopilotStatusBadgeProps) {
  if (status === 'inactive') return null;

  const getStatusConfig = (): { icon: LucideIcon; color: string; bg: string; label: string } => {
    switch (status) {
      case 'active':
        return {
          icon: Brain,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          label: 'Active',
        };
      case 'paused':
        return {
          icon: Pause,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
          label: 'Paused',
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          label: 'Error',
        };
      case 'goal-completed':
        return {
          icon: CheckCircle,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          label: 'Goal Reached',
        };
      default:
        return {
          icon: Brain,
          color: 'text-muted-foreground',
          bg: 'bg-muted',
          label: status,
        };
    }
  };

  const config = getStatusConfig();

  const formatTime = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      return `${hrs}h`;
    }
    return `${mins}m`;
  };

  const timeStr = formatTime(timeRemaining);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs',
              config.bg,
              config.color,
              className
            )}
          >
            <config.icon className="h-3 w-3" />
            {showLabel && <span>{config.label}</span>}
            {timeStr && mode === 'self-driving' && status === 'active' && (
              <span className="font-mono">{timeStr}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div className="font-medium">
              Autopilot: {config.label}
            </div>
            {agentName && (
              <div className="text-muted-foreground">
                Agent: {agentName}
              </div>
            )}
            {mode && (
              <div className="text-muted-foreground">
                Mode: {mode === 'self-driving' ? 'Self-Driving' : 'Manual Approval'}
              </div>
            )}
            {timeStr && mode === 'self-driving' && (
              <div className="text-muted-foreground">
                Time remaining: {timeStr}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
