'use client';

import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { useAutopilot } from '@/contexts/autopilot-context';
import { usePendingDrafts } from '@/hooks/use-pending-drafts';
import { useLastActivity } from '@/hooks/use-last-activity';
import { DraftApprovalSection } from '@/components/message-input/draft-approval-section';
import { AutopilotStatusBadge } from './autopilot-status-badge';
import { AutopilotCurrentActivity } from './autopilot-current-activity';
import { AutopilotActivityLog } from './autopilot-activity-log';
import { AutopilotControlsBar } from './autopilot-controls-bar';

interface AutopilotActiveSectionProps {
  chatId: string;
  compactMode?: boolean; // Show only status and activity (replaces input field)
  controlsOnly?: boolean; // Show only controls (replaces button bar)
}

export function AutopilotActiveSection({ chatId, compactMode, controlsOnly }: AutopilotActiveSectionProps) {
  const { configVersion, notifyConfigChange, regenerateDraft } = useAutopilot();
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
  const pendingDraft = usePendingDrafts(chatId, config, status);
  const lastActivity = useLastActivity(chatId);

  // Get agent details
  const agent = config ? getAgentById(config.agentId) : undefined;

  const handleExtendTime = (additionalMinutes: number) => {
    if (!config?.selfDrivingDurationMinutes) return;
    const newDuration = config.selfDrivingDurationMinutes + additionalMinutes;
    setSelfDrivingDuration(newDuration);
    notifyConfigChange();
  };

  const handleRedoDraft = () => {
    if (pendingDraft?.messageId) {
      regenerateDraft(pendingDraft.messageId);
    } else {
      console.error('No messageId found for pending draft to regenerate');
      // Optionally show a toast error
    }
    notifyConfigChange(); // To re-trigger draft generation display
  };

  if (!config || !isEnabled) {
    return null;
  }

  // Compact mode - show only status and activity (replaces textarea)
  if (compactMode) {
    return (
      <div className="space-y-2 min-h-[60px]">
        {/* Status Header */}
        <div className="flex items-center gap-2">
          <AutopilotStatusBadge
            status={status}
            mode={config.mode}
            agentName={agent?.name}
            timeRemaining={timeRemaining}
          />
          <span className="text-xs text-muted-foreground">
            {agent?.name || 'Unknown Agent'}
          </span>
        </div>

        {/* Current Activity */}
        <AutopilotCurrentActivity
          status={status}
          mode={config.mode}
          lastActivity={lastActivity}
          errorMessage={config.lastError}
        />

        {/* Draft Preview (Manual Approval Mode) */}
        {config.mode === 'manual-approval' && pendingDraft && status === 'active' && (
          <div className="border rounded-lg p-2 bg-muted/50 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Draft for Approval:
            </label>
            <div className="text-xs whitespace-pre-wrap bg-background p-2 rounded border max-h-[60px] overflow-y-auto">
              {pendingDraft.draft}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Controls only mode - show only controls (replaces button bar)
  if (controlsOnly) {
    return (
      <div className="space-y-2">
        {/* Draft Approval Buttons (Manual Approval Mode) */}
        {config.mode === 'manual-approval' && pendingDraft && status === 'active' && (
          <DraftApprovalSection
            chatId={chatId}
            agentId={config.agentId}
            pendingDraft={pendingDraft.draft}
            pendingActionId={pendingDraft.actionId}
            onApprove={notifyConfigChange}
            onReject={notifyConfigChange}
            onRedo={handleRedoDraft}
          />
        )}

        {/* Autopilot Controls */}
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
    );
  }

  // Full mode - show everything (original behavior)
  return (
    <div className="space-y-2">
      {/* Status Header */}
      <div className="flex items-center gap-2">
        <AutopilotStatusBadge
          status={status}
          mode={config.mode}
          agentName={agent?.name}
          timeRemaining={timeRemaining}
        />
        <span className="text-xs text-muted-foreground">
          {agent?.name || 'Unknown Agent'}
        </span>
      </div>

      {/* Current Activity */}
      <AutopilotCurrentActivity
        status={status}
        mode={config.mode}
        lastActivity={lastActivity}
        errorMessage={config.lastError}
      />

      <Separator className="my-2" />

      {/* Draft Preview (Manual Approval Mode) */}
      {config.mode === 'manual-approval' && pendingDraft && status === 'active' && (
        <>
          <Separator />
          <DraftApprovalSection
            chatId={chatId}
            agentId={config.agentId}
            pendingDraft={pendingDraft.draft}
            pendingActionId={pendingDraft.actionId}
            onApprove={notifyConfigChange}
            onReject={notifyConfigChange}
            onRedo={handleRedoDraft}
          />
        </>
      )}

      <Separator />

      {/* Activity Log */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Activity Log:</label>
        <AutopilotActivityLog chatId={chatId} />
      </div>

      <Separator />

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
  );
}
