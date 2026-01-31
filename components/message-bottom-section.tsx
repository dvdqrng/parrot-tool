'use client';

import { useState, useEffect, useRef } from 'react';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { useAutopilot } from '@/contexts/autopilot-context';
import { usePendingDrafts } from '@/hooks/use-pending-drafts';
import { useLastActivity } from '@/hooks/use-last-activity';
import { useSchedulerStatus } from '@/hooks/use-scheduler-status';
import { ManualInputSection } from '@/components/message-input/manual-input-section';
import { AutopilotMode, AutopilotAgent } from '@/lib/types';
import { BeeperMessage } from '@/lib/types';
import { logger } from '@/lib/logger';
import { ensureDefaultObserverAgent, addAutopilotAgent } from '@/lib/storage';
import { AGENT_TEMPLATES, createAgentFromTemplate } from '@/lib/agent-templates';

interface MessageBottomSectionProps {
  chatId: string | null;
  chatName: string;
  latestMessage?: BeeperMessage;
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isGenerating: boolean;
  onGenerateAI: () => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  onSaveDraft: () => void;
  aiEnabled?: boolean;
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
    pause,
    resume,
    disable,
    enable,
    setAgent,
    setMode,
  } = useChatAutopilot(chatId, { configVersion });

  const { agents } = useAutopilotAgents();
  const pendingDraft = usePendingDrafts(chatId, config, status);
  const lastActivity = useLastActivity(chatId);
  const schedulerStatus = useSchedulerStatus(chatId);

  // UI state
  const shouldTriggerActionRef = useRef(false);
  const [triggerVersion, setTriggerVersion] = useState(0);
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);

  // Pre-invite overlay state
  const [showInviteOverlay, setShowInviteOverlay] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<AutopilotMode>('observer');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Calculate if autopilot is active
  const isAutopilotActive = isEnabled && status !== 'inactive';

  // Close invite overlay when agent becomes active
  useEffect(() => {
    if (isAutopilotActive) {
      setShowInviteOverlay(false);
    }
  }, [isAutopilotActive]);

  // Clear regenerating state when a new draft arrives
  useEffect(() => {
    if (pendingDraft && isRegeneratingDraft) {
      setIsRegeneratingDraft(false);
    }
  }, [pendingDraft, isRegeneratingDraft]);

  // Trigger action when autopilot becomes active after enabling
  useEffect(() => {
    if (!shouldTriggerActionRef.current || !isAutopilotActive || !chatId) return;

    // Observer mode never triggers message processing or proactive sends
    if (config?.mode === 'observer') {
      shouldTriggerActionRef.current = false;
      return;
    }

    logger.autopilot('[MessageBottomSection] Autopilot now active, triggering action', { chatId, status });
    shouldTriggerActionRef.current = false;

    const currentChatId = chatId;
    const currentMessage = latestMessage;

    const timer = setTimeout(() => {
      if (currentMessage && !currentMessage.isFromMe) {
        logger.autopilot('[MessageBottomSection] Processing existing message', { messageId: currentMessage.id });
        triggerChatProcessing(currentChatId, currentMessage);
      } else {
        logger.autopilot('[MessageBottomSection] Generating proactive message');
        generateProactiveMessage(currentChatId);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [triggerVersion, isAutopilotActive, chatId, latestMessage, status, triggerChatProcessing, generateProactiveMessage, config?.mode]);

  // Handle invite agent with selected level + optional template
  const handleInviteAgent = () => {
    if (!chatId) return;

    let agentId: string;

    if (selectedTemplateId) {
      // Create agent from selected template
      const template = AGENT_TEMPLATES.find(t => t.id === selectedTemplateId);
      if (template) {
        const agentData = createAgentFromTemplate(template);
        const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const newAgent: AutopilotAgent = {
          ...agentData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        addAutopilotAgent(newAgent);
        agentId = id;
      } else {
        agentId = ensureDefaultObserverAgent();
      }
    } else {
      // No template selected — use default observer agent
      agentId = ensureDefaultObserverAgent();
    }

    logger.autopilot('[MessageBottomSection] Inviting agent', {
      chatId,
      agentId,
      mode: selectedLevel,
      templateId: selectedTemplateId,
    });

    // Set trigger flag for non-observer modes
    if (selectedLevel !== 'observer') {
      shouldTriggerActionRef.current = true;
    }

    enable(agentId, selectedLevel, selectedLevel === 'self-driving' ? selectedDuration : undefined);
    notifyConfigChange();
    setShowInviteOverlay(false);

    if (selectedLevel !== 'observer') {
      setTriggerVersion(v => v + 1);
    }
  };

  const handleModeChange = (mode: AutopilotMode, durationMinutes?: number) => {
    if (!isAutopilotActive) return;
    const duration = mode === 'self-driving' ? (durationMinutes || selectedDuration) : undefined;
    setMode(mode, duration);
    notifyConfigChange();

    // Trigger processing whenever switching to a non-observer mode
    if (mode !== 'observer' && mode !== config?.mode) {
      shouldTriggerActionRef.current = true;
      setTriggerVersion(v => v + 1);
    }
  };

  const handleAgentChange = (agentId: string) => {
    if (!isAutopilotActive) return;
    setAgent(agentId);
    notifyConfigChange();
  };

  const handleDismiss = () => {
    disable();
    notifyConfigChange();
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
      showAutopilotButton={!!chatId && aiEnabled}
      aiEnabled={aiEnabled}
      // Pre-invite overlay
      showInviteOverlay={showInviteOverlay}
      onToggleInviteOverlay={() => setShowInviteOverlay(prev => !prev)}
      selectedLevel={selectedLevel}
      onLevelChange={setSelectedLevel}
      selectedDuration={selectedDuration}
      onDurationChange={setSelectedDuration}
      templates={AGENT_TEMPLATES}
      selectedTemplateId={selectedTemplateId}
      onTemplateSelect={setSelectedTemplateId}
      onInviteAgent={handleInviteAgent}
      // Active agent overlay
      agentActive={isAutopilotActive}
      agentStatus={isAutopilotActive ? status : undefined}
      agentMode={isAutopilotActive ? (config?.mode || 'observer') : undefined}
      agents={agents}
      selectedAgentId={config?.agentId}
      lastActivity={lastActivity}
      schedulerStatus={schedulerStatus}
      onModeChange={handleModeChange}
      onAgentChange={handleAgentChange}
      onPause={pause}
      onResume={resume}
      onDismiss={handleDismiss}
      // Draft approval
      pendingDraft={pendingDraft?.draft}
      pendingActionId={pendingDraft?.actionId}
      onDraftApprove={handleDraftApproved}
      onDraftReject={handleDraftRejected}
      onDraftRedo={handleDraftRedo}
      isRegeneratingDraft={isRegeneratingDraft}
    />
  );
}
