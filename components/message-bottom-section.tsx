'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Pause, Play, Square, Settings as SettingsIcon } from 'lucide-react';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { useAutopilot } from '@/contexts/autopilot-context';
import { usePendingDrafts } from '@/hooks/use-pending-drafts';
import { useLastActivity } from '@/hooks/use-last-activity';
import { useSchedulerStatus } from '@/hooks/use-scheduler-status';
import { ManualInputSection } from '@/components/message-input/manual-input-section';
import { AutopilotConfigIcons } from '@/components/message-input/autopilot-config-icons';
import { AutopilotStatusDisplay } from '@/components/message-input/autopilot-status-display';
import { DraftApprovalSection } from '@/components/message-input/draft-approval-section';
import { AutopilotMode } from '@/lib/types';
import { BeeperMessage } from '@/lib/types';
import { logger } from '@/lib/logger';

interface MessageBottomSectionProps {
  chatId: string | null;
  chatName: string;
  latestMessage?: BeeperMessage;
  // Manual mode props
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isGenerating: boolean;
  onGenerateAI: () => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  onSaveDraft: () => void;
  // AI features enabled
  aiEnabled?: boolean;
}

interface LocalAutopilotConfig {
  agentId: string;
  mode: AutopilotMode;
  duration: number;
}

export function MessageBottomSection({
  chatId,
  chatName,
  latestMessage,
  draftText,
  onDraftTextChange,
  isGenerating,
  onGenerateAI,
  isSending,
  sendSuccess,
  onSend,
  onSaveDraft,
  aiEnabled = true,
}: MessageBottomSectionProps) {
  const { configVersion, notifyConfigChange, triggerChatProcessing, generateProactiveMessage } = useAutopilot();
  const {
    config,
    status,
    isEnabled,
    timeRemaining,
    pause,
    resume,
    disable,
    enable,
    setAgent,
    setMode,
    setSelfDrivingDuration,
  } = useChatAutopilot(chatId, { configVersion });

  const { agents, getAgentById } = useAutopilotAgents();
  const pendingDraft = usePendingDrafts(chatId, config, status);
  const lastActivity = useLastActivity(chatId);
  const schedulerStatus = useSchedulerStatus(chatId);

  // Local configuration state (used when autopilot is not enabled)
  const [localConfig, setLocalConfig] = useState<LocalAutopilotConfig>({
    agentId: '',
    mode: 'manual-approval',
    duration: 30,
  });

  // UI state
  const [showAutopilotConfig, setShowAutopilotConfig] = useState(false);
  const shouldTriggerActionRef = useRef(false);
  const [triggerVersion, setTriggerVersion] = useState(0);
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);

  // Calculate if autopilot is active
  const isAutopilotActive = isEnabled && status !== 'inactive';

  // Clear regenerating state when a new draft arrives
  useEffect(() => {
    if (pendingDraft && isRegeneratingDraft) {
      setIsRegeneratingDraft(false);
    }
  }, [pendingDraft, isRegeneratingDraft]);

  // Initialize agent selection
  useEffect(() => {
    if (agents.length > 0 && !localConfig.agentId) {
      setLocalConfig((prev) => ({ ...prev, agentId: agents[0].id }));
    }
  }, [agents, localConfig.agentId]);

  // Trigger action when autopilot becomes active after enabling
  useEffect(() => {
    logger.autopilot('[MessageBottomSection] useEffect check', {
      shouldTriggerAction: shouldTriggerActionRef.current,
      triggerVersion,
      isAutopilotActive,
      chatId: !!chatId
    });

    if (!shouldTriggerActionRef.current || !isAutopilotActive || !chatId) return;

    logger.autopilot('[MessageBottomSection] ✅ Autopilot now active, triggering action', { chatId, status });

    // Clear the trigger flag (using ref, doesn't cause re-render)
    shouldTriggerActionRef.current = false;

    // Capture current values
    const currentChatId = chatId;
    const currentMessage = latestMessage;

    // Small delay to ensure config is fully synced
    const timer = setTimeout(() => {
      logger.autopilot('[MessageBottomSection] 🔥 Timer fired, checking message state', {
        hasLatestMessage: !!currentMessage,
        isFromMe: currentMessage?.isFromMe,
        messageText: currentMessage?.text?.slice(0, 50)
      });

      if (currentMessage && !currentMessage.isFromMe) {
        // If there's a message from the other person (read or unread), process it
        logger.autopilot('[MessageBottomSection] 📨 Processing existing message', { messageId: currentMessage.id, isRead: currentMessage.isRead });
        triggerChatProcessing(currentChatId, currentMessage);
      } else {
        // No message from them, or only our messages - send proactive message
        logger.autopilot('[MessageBottomSection] 🚀 No message to respond to, generating proactive message');
        generateProactiveMessage(currentChatId);
      }
    }, 500);

    return () => {
      logger.autopilot('[MessageBottomSection] Cleaning up timer');
      clearTimeout(timer);
    };
  }, [triggerVersion, isAutopilotActive, chatId, latestMessage, status, triggerChatProcessing, generateProactiveMessage]);

  // Get agent details
  const agent = config ? getAgentById(config.agentId) : undefined;

  const handleEnableAutopilot = () => {
    if (!localConfig.agentId || !chatId) {
      logger.autopilot('[MessageBottomSection] ❌ Cannot enable - missing agentId or chatId', { agentId: localConfig.agentId, chatId });
      return;
    }

    logger.autopilot('[MessageBottomSection] 🟢 Enabling autopilot', {
      chatId,
      agentId: localConfig.agentId,
      mode: localConfig.mode,
      duration: localConfig.duration
    });

    // Set flag to trigger action once autopilot is active (using ref to avoid re-render)
    logger.autopilot('[MessageBottomSection] Setting shouldTriggerAction ref = true');
    shouldTriggerActionRef.current = true;

    // Enable autopilot
    logger.autopilot('[MessageBottomSection] Calling enable()');
    enable(
      localConfig.agentId,
      localConfig.mode,
      localConfig.mode === 'self-driving' ? localConfig.duration : undefined
    );

    logger.autopilot('[MessageBottomSection] Calling notifyConfigChange()');
    notifyConfigChange();

    logger.autopilot('[MessageBottomSection] Hiding config UI');
    setShowAutopilotConfig(false);

    // Increment trigger version to cause effect to run
    logger.autopilot('[MessageBottomSection] Incrementing trigger version');
    setTriggerVersion(v => v + 1);
  };

  const handleDraftApproved = () => {
    setIsRegeneratingDraft(false);
    notifyConfigChange();
  };

  const handleDraftRejected = () => {
    setIsRegeneratingDraft(false);
    notifyConfigChange();
  };

  const handleDraftRedo = () => {
    setIsRegeneratingDraft(true);
    notifyConfigChange();
  };

  // Render manual mode
  if (!showAutopilotConfig && !isEnabled) {
    return (
      <ManualInputSection
        draftText={draftText}
        onDraftTextChange={onDraftTextChange}
        isGenerating={isGenerating}
        onGenerateAI={onGenerateAI}
        isSending={isSending}
        sendSuccess={sendSuccess}
        onSend={onSend}
        onSaveDraft={onSaveDraft}
        onShowAutopilot={handleEnableAutopilot}
        showAutopilotButton={!!chatId && aiEnabled}
        autopilotButtonHref={agents.length === 0 ? '/settings/autopilot/agents/new' : undefined}
        aiEnabled={aiEnabled}
      />
    );
  }

  // Render autopilot mode (config + status + controls)
  if (!chatId) return null;

  return (
    <div className="space-y-3">
      {/* Status Display */}
      <div className="border rounded-lg p-2">
        <AutopilotStatusDisplay
          status={status}
          mode={config?.mode || 'manual-approval'}
          agentName={agent?.name}
          timeRemaining={timeRemaining}
          lastActivity={lastActivity}
          errorMessage={config?.lastError}
          isActive={isAutopilotActive}
          schedulerStatus={schedulerStatus}
        />
      </div>

      {/* Draft Approval (Manual Approval Mode) */}
      {isAutopilotActive &&
       config?.mode === 'manual-approval' &&
       (pendingDraft || isRegeneratingDraft) &&
       status === 'active' && (
        <DraftApprovalSection
          chatId={chatId}
          agentId={config.agentId}
          pendingDraft={pendingDraft?.draft || ''}
          pendingActionId={pendingDraft?.actionId || ''}
          onApprove={handleDraftApproved}
          onReject={handleDraftRejected}
          onRedo={handleDraftRedo}
          isRegenerating={isRegeneratingDraft}
        />
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {/* Left side: Cancel + Config Icons */}
        {!isAutopilotActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowAutopilotConfig(false)}
            title="Back to Manual"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </Button>
        )}

        <AutopilotConfigIcons
          agents={agents}
          selectedAgentId={isAutopilotActive ? (config?.agentId || '') : localConfig.agentId}
          selectedMode={isAutopilotActive ? (config?.mode || 'manual-approval') : localConfig.mode}
          selectedDuration={isAutopilotActive ? (config?.selfDrivingDurationMinutes || 30) : localConfig.duration}
          onAgentChange={(agentId) => {
            if (isAutopilotActive) {
              setAgent(agentId);
              notifyConfigChange();
            } else {
              setLocalConfig((prev) => ({ ...prev, agentId }));
            }
          }}
          onModeChange={(mode) => {
            if (isAutopilotActive) {
              setMode(mode, mode === 'self-driving' ? localConfig.duration : undefined);
              notifyConfigChange();
            } else {
              setLocalConfig((prev) => ({ ...prev, mode }));
            }
          }}
          onDurationChange={(duration) => {
            if (isAutopilotActive) {
              setSelfDrivingDuration(duration);
              notifyConfigChange();
            } else {
              setLocalConfig((prev) => ({ ...prev, duration }));
            }
          }}
          isActive={isAutopilotActive}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: Control Buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          asChild
          title="Manage Agents"
        >
          <a href="/settings/autopilot/agents">
            <SettingsIcon className="h-4 w-4" strokeWidth={2} />
          </a>
        </Button>

        {isAutopilotActive && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={status === 'paused' ? resume : pause}
              title={status === 'paused' ? 'Resume' : 'Pause'}
              disabled={status !== 'active' && status !== 'paused'}
            >
              {status === 'paused' ? (
                <Play className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Pause className="h-4 w-4 fill-yellow-500 text-yellow-500" strokeWidth={2} />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                disable();
                notifyConfigChange();
                setShowAutopilotConfig(false);
              }}
              title="Stop Autopilot"
            >
              <Square className="h-4 w-4 fill-red-500 text-red-500" strokeWidth={2} />
            </Button>
          </>
        )}

        {!isAutopilotActive && (
          <Button
            className="flex-1"
            onClick={handleEnableAutopilot}
            disabled={!localConfig.agentId}
          >
            Start
          </Button>
        )}
      </div>
    </div>
  );
}
