'use client';

import { Brain, Eye, Lightbulb, Pause, AlertCircle, CheckCircle, LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AutopilotStatus, AutopilotMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatTimeRemaining } from '@/lib/time-utils';

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
    // Observer mode: subtle muted style
    if (mode === 'observer' && status === 'active') {
      return {
        icon: Eye,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        label: 'Observing',
      };
    }

    // Suggest mode: warm style
    if (mode === 'suggest' && status === 'active') {
      return {
        icon: Lightbulb,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        label: 'Suggesting',
      };
    }

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
  const timeStr = formatTimeRemaining(timeRemaining, 'short') || null;

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
            <config.icon className="h-4 w-4" strokeWidth={2} />
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
                Mode: {mode === 'observer' ? 'Observer' : mode === 'suggest' ? 'Suggest' : mode === 'self-driving' ? 'Self-Driving' : 'Manual Approval'}
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
