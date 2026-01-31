'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, Send, Save, Check, ListStart, Eye, Lightbulb, Hand, Zap, Settings as SettingsIcon, X, Pause, Play, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { AnimatedGradientSphere } from '@/components/ui/animated-gradient-sphere';
import { AutopilotCurrentActivity } from '@/components/autopilot/autopilot-current-activity';
import { DraftApprovalSection } from '@/components/message-input/draft-approval-section';
import { AutopilotStatus, AutopilotMode, AutopilotActivityEntry, AutopilotAgent } from '@/lib/types';
import { AgentTemplate } from '@/lib/agent-templates';
import { SchedulerStatus } from '@/hooks/use-scheduler-status';

interface ManualInputSectionProps {
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isGenerating: boolean;
  onGenerateAI: () => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  onSaveDraft: () => void;
  showAutopilotButton: boolean;
  aiEnabled?: boolean;
  // Pre-invite overlay
  showInviteOverlay?: boolean;
  onToggleInviteOverlay?: () => void;
  selectedLevel?: AutopilotMode;
  onLevelChange?: (mode: AutopilotMode) => void;
  templates?: AgentTemplate[];
  selectedTemplateId?: string | null;
  onTemplateSelect?: (templateId: string | null) => void;
  onInviteAgent?: () => void;
  // Active agent inline panel
  agentActive?: boolean;
  agentStatus?: AutopilotStatus;
  agentMode?: AutopilotMode;
  agents?: AutopilotAgent[];
  selectedAgentId?: string;
  lastActivity?: AutopilotActivityEntry | null;
  schedulerStatus?: SchedulerStatus;
  onModeChange?: (mode: AutopilotMode) => void;
  onAgentChange?: (agentId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onDismiss?: () => void;
  // Draft approval props
  pendingDraft?: string;
  pendingActionId?: string;
  onDraftApprove?: () => void;
  onDraftReject?: () => void;
  onDraftRedo?: () => void;
  isRegeneratingDraft?: boolean;
}

const LEVEL_OPTIONS: SegmentedControlItem<AutopilotMode>[] = [
  { value: 'observer', label: 'Observer', icon: Eye },
  { value: 'suggest', label: 'Suggest', icon: Lightbulb },
  { value: 'manual-approval', label: 'Approval', icon: Hand },
  { value: 'self-driving', label: 'Auto', icon: Zap },
];

export function ManualInputSection({
  draftText,
  onDraftTextChange,
  isGenerating,
  onGenerateAI,
  isSending,
  sendSuccess,
  onSend,
  onSaveDraft,
  showAutopilotButton,
  aiEnabled = true,
  showInviteOverlay,
  onToggleInviteOverlay,
  selectedLevel,
  onLevelChange,
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onInviteAgent,
  agentActive,
  agentStatus,
  agentMode,
  agents,
  selectedAgentId,
  lastActivity,
  schedulerStatus,
  onModeChange,
  onAgentChange,
  onPause,
  onResume,
  onDismiss,
  pendingDraft,
  pendingActionId,
  onDraftApprove,
  onDraftReject,
  onDraftRedo,
  isRegeneratingDraft,
}: ManualInputSectionProps) {
  const isActive = agentStatus === 'active' || agentStatus === 'paused';
  // Agent is only truly ready if we have all the data needed to render controls
  const agentReady = agentActive && !!agentStatus && !!agentMode;
  const [panelExpanded, setPanelExpanded] = useState(false);

  // Overlay is ONLY for the pre-invite configuration (not active agent controls)
  const overlayOpen = showInviteOverlay && !agentReady;

  // Animation state — matches the pattern from filter-dialog / group-by-dialog / contacts-dialog
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (overlayOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [overlayOpen]);

  // Close overlay on escape key
  useEffect(() => {
    if (!overlayOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggleInviteOverlay?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [overlayOpen, onToggleInviteOverlay]);

  return (
    <div>
      {/* Active Agent Inline Panel — sits above the textarea in normal flow */}
      {agentActive && agentStatus && agentMode && (
        <div className="mb-3 p-3 bg-card border rounded-2xl space-y-2">
          {/* Top row: Activity Status + Controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AutopilotCurrentActivity
                status={agentStatus}
                mode={agentMode}
                lastActivity={lastActivity || null}
                schedulerStatus={schedulerStatus}
              />
            </div>
            <div className="flex items-center gap-0.5">
              {isActive && agentMode !== 'observer' && (
                <button
                  onClick={agentStatus === 'paused' ? onResume : onPause}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  title={agentStatus === 'paused' ? 'Resume' : 'Pause'}
                >
                  {agentStatus === 'paused' ? (
                    <Play className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </button>
              )}
              <button
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                title="Stop Agent"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                onClick={() => setPanelExpanded(prev => !prev)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                title={panelExpanded ? 'Collapse' : 'Expand'}
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', panelExpanded && 'rotate-180')} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Expanded section: agent name + level selector */}
          {panelExpanded && (
            <div className="space-y-2 pt-1">
              {/* Current agent name */}
              {selectedAgentId && agents && (
                <p className="text-xs text-muted-foreground">
                  Agent: {agents.find(a => a.id === selectedAgentId)?.name || 'Unknown'}
                </p>
              )}

              {/* Mode Segmented Control */}
              <SegmentedControl
                items={LEVEL_OPTIONS}
                value={agentMode!}
                onValueChange={(mode) => onModeChange?.(mode)}
              />
            </div>
          )}

          {/* Draft Approval (Manual Approval Mode) — always visible when applicable */}
          {agentMode === 'manual-approval' &&
           pendingDraft &&
           pendingActionId &&
           selectedAgentId &&
           (pendingDraft || isRegeneratingDraft) && (
            <DraftApprovalSection
              chatId=""
              agentId={selectedAgentId}
              pendingDraft={pendingDraft}
              pendingActionId={pendingActionId}
              onApprove={onDraftApprove || (() => {})}
              onReject={onDraftReject || (() => {})}
              onRedo={onDraftRedo || (() => {})}
              isRegenerating={isRegeneratingDraft}
            />
          )}

        </div>
      )}

      {/* Input Area */}
      <div className="space-y-3">
        {/* Input Textarea */}
        <Textarea
          placeholder="Type your reply..."
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              if (draftText.trim() && !isSending && !sendSuccess) {
                onSend();
              }
            }
          }}
          className="min-h-[80px] resize-none shadow-none"
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Agent Icon Button + Pre-invite Overlay anchor */}
          {aiEnabled && showAutopilotButton && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                title="Agent"
                onClick={onToggleInviteOverlay}
              >
                <AnimatedGradientSphere />
              </Button>

              {/* Pre-invite Overlay — floats above the agent icon */}
              {shouldRender && (
                <>
                  {/* Backdrop */}
                  <div
                    className={`fixed inset-0 -z-10 bg-background/60 backdrop-blur-sm transition-opacity duration-150 ${
                      isVisible ? 'opacity-100' : 'opacity-0'
                    }`}
                    onClick={() => onToggleInviteOverlay?.()}
                  />

                  {/* Overlay panel — anchored above the agent icon */}
                  <div
                    className={`absolute bottom-full mb-2 left-0 w-[320px] bg-card border rounded-2xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-out ${
                      isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
                    }`}
                    style={{ transformOrigin: 'bottom left' }}
                  >
                    <div className="p-3 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">Invite Agent</p>
                        <button
                          onClick={onToggleInviteOverlay}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          title="Close"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>

                      {/* Level Segmented Control */}
                      <SegmentedControl
                        items={LEVEL_OPTIONS}
                        value={selectedLevel!}
                        onValueChange={(mode) => onLevelChange?.(mode)}
                      />

                      {/* Template Carousel (horizontal scroll) */}
                      {templates && templates.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Template (optional)</p>
                          <ScrollArea className="w-full">
                            <div className="flex gap-2 pb-2">
                              {templates.map((template) => (
                                <button
                                  key={template.id}
                                  onClick={() => onTemplateSelect?.(
                                    selectedTemplateId === template.id ? null : template.id
                                  )}
                                  className={cn(
                                    'flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all',
                                    selectedTemplateId === template.id
                                      ? 'border-foreground bg-foreground/5 text-foreground font-medium'
                                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                                  )}
                                >
                                  <span>{template.emoji}</span>
                                  <span className="whitespace-nowrap">{template.name}</span>
                                </button>
                              ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          className="flex-1"
                          size="sm"
                          onClick={onInviteAgent}
                        >
                          Invite Agent
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href="/settings/autopilot/agents">
                            <SettingsIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                            Settings
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI Draft Button */}
          {aiEnabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onGenerateAI}
              disabled={isGenerating}
              title="AI Draft"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <ListStart className="h-4 w-4 rotate-180" strokeWidth={2} />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onSaveDraft}
            disabled={!draftText.trim()}
            title="Save Draft"
          >
            <Save className="h-4 w-4" strokeWidth={2} />
          </Button>

          <div className="flex-1" />

          <Button
            className={cn(
              "min-w-[100px] transition-colors",
              sendSuccess && "bg-green-600 hover:bg-green-600"
            )}
            onClick={onSend}
            disabled={!draftText.trim() || isSending || sendSuccess}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
            ) : sendSuccess ? (
              <Check className="h-4 w-4 mr-2" strokeWidth={2} />
            ) : (
              <Send className="h-4 w-4 mr-2" strokeWidth={2} />
            )}
            {isSending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
