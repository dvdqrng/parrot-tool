'use client';

import { useEffect } from 'react';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { useAutopilot } from '@/contexts/autopilot-context';
import { useLastActivity } from '@/hooks/use-last-activity';
import { Badge } from '@/components/ui/badge';
import { AutopilotStatusBadge } from './autopilot-status-badge';
import { AutopilotCurrentActivity } from './autopilot-current-activity';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AutopilotActivityLog } from './autopilot-activity-log';
import { AutopilotControlsBar } from './autopilot-controls-bar';

interface AutopilotHeaderStatusProps {
  chatId: string;
}

export function AutopilotHeaderStatus({ chatId }: AutopilotHeaderStatusProps) {
  const { configVersion } = useAutopilot();
  const {
    config,
    status,
    isEnabled,
    timeRemaining,
    pause,
    resume,
    disable,
    setAgent,
    setMode,
    setSelfDrivingDuration,
  } = useChatAutopilot(chatId, { configVersion });

  const { agents, getAgentById } = useAutopilotAgents();
  const lastActivity = useLastActivity(chatId);

  // Get agent details
  const agent = config ? getAgentById(config.agentId) : undefined;

  if (!config || !isEnabled || status === 'inactive') {
    return null;
  }

  const handleExtendTime = (additionalMinutes: number) => {
    if (!config?.selfDrivingDurationMinutes) return;
    const newDuration = config.selfDrivingDurationMinutes + additionalMinutes;
    setSelfDrivingDuration(newDuration);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border">
          <AutopilotStatusBadge
            status={status}
            mode={config.mode}
            agentName={agent?.name}
            timeRemaining={timeRemaining}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{agent?.name || 'Unknown Agent'}</span>
            <span className="text-xs text-muted-foreground truncate">
              {config.mode === 'manual-approval' ? 'Manual Approval' : 'Self-Driving'}
            </span>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px]" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AutopilotStatusBadge
                status={status}
                mode={config.mode}
                agentName={agent?.name}
                timeRemaining={timeRemaining}
                showLabel
              />
              <div>
                <p className="text-sm font-medium">{agent?.name || 'Unknown Agent'}</p>
                <p className="text-xs text-muted-foreground">
                  {config.messagesHandled} messages handled
                </p>
              </div>
            </div>
          </div>

          {/* Current Activity */}
          <AutopilotCurrentActivity
            status={status}
            mode={config.mode}
            lastActivity={lastActivity}
            errorMessage={config.lastError}
          />

          {/* Activity Log */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Recent Activity:</label>
            <AutopilotActivityLog chatId={chatId} />
          </div>

          {/* Controls */}
          <AutopilotControlsBar
            chatId={chatId}
            config={config}
            agents={agents}
            onPause={pause}
            onResume={resume}
            onStop={disable}
            onSetAgent={setAgent}
            onSetMode={setMode}
            onExtendTime={handleExtendTime}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
