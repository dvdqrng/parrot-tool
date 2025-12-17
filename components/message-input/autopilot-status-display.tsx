'use client';

import { AutopilotStatusBadge } from '@/components/autopilot/autopilot-status-badge';
import { AutopilotCurrentActivity } from '@/components/autopilot/autopilot-current-activity';
import { AutopilotStatus, AutopilotMode, AutopilotActivityEntry } from '@/lib/types';
import { SchedulerStatus } from '@/hooks/use-scheduler-status';

interface AutopilotStatusDisplayProps {
  status: AutopilotStatus;
  mode: AutopilotMode;
  agentName?: string;
  timeRemaining: number | null;
  lastActivity: AutopilotActivityEntry | null;
  errorMessage?: string;
  isActive: boolean;
  schedulerStatus?: SchedulerStatus;
}

export function AutopilotStatusDisplay({
  status,
  mode,
  agentName,
  timeRemaining,
  lastActivity,
  errorMessage,
  isActive,
  schedulerStatus,
}: AutopilotStatusDisplayProps) {
  if (!isActive) {
    return (
      <div className="text-center py-2 text-xs text-muted-foreground">
        Autopilot not started. Configure and press Start.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <AutopilotStatusBadge
        status={status}
        mode={mode}
        agentName={agentName}
        timeRemaining={timeRemaining}
      />
      <AutopilotCurrentActivity
        status={status}
        mode={mode}
        lastActivity={lastActivity}
        errorMessage={errorMessage}
        schedulerStatus={schedulerStatus}
      />
    </div>
  );
}
