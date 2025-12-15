'use client';

import { useState, useEffect } from 'react';
import { Bot, Play, Pause, Square, Clock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { useAutopilot } from '@/contexts/autopilot-context';
import { AutopilotMode, BeeperMessage } from '@/lib/types';
import Link from 'next/link';

interface ChatAutopilotConfigProps {
  chatId: string;
  chatName?: string;
  latestMessage?: BeeperMessage; // Pass the latest message to trigger processing when enabled
}

const DURATION_OPTIONS = [
  { value: 10, label: '10 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 480, label: '8 hours' },
];

export function ChatAutopilotConfig({ chatId, chatName, latestMessage }: ChatAutopilotConfigProps) {
  const { agents, isLoaded: agentsLoaded } = useAutopilotAgents();
  const { triggerChatProcessing, notifyConfigChange } = useAutopilot();
  const {
    config,
    isLoaded: configLoaded,
    isEnabled,
    status,
    isExpired,
    timeRemaining,
    enable,
    disable,
    pause,
    resume,
    setMode,
    setAgent,
    setSelfDrivingDuration,
  } = useChatAutopilot(chatId);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<AutopilotMode>('manual-approval');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize form from existing config
  useEffect(() => {
    if (config) {
      setSelectedAgentId(config.agentId);
      setSelectedMode(config.mode);
      if (config.selfDrivingDurationMinutes) {
        setSelectedDuration(config.selfDrivingDurationMinutes);
      }
    } else if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [config, agents, selectedAgentId]);

  const handleEnable = () => {
    if (!selectedAgentId) return;
    console.log('[ChatAutopilotConfig] Enabling autopilot', { chatId, selectedAgentId, selectedMode, latestMessage: latestMessage ? { id: latestMessage.id, isFromMe: latestMessage.isFromMe, isRead: latestMessage.isRead, text: latestMessage.text?.slice(0, 30) } : null });
    enable(
      selectedAgentId,
      selectedMode,
      selectedMode === 'self-driving' ? selectedDuration : undefined
    );
    setIsOpen(false);

    // Notify that config changed so UI updates (e.g., autopilot column appears)
    notifyConfigChange();

    // If there's an unread message, trigger autopilot processing immediately
    if (latestMessage && !latestMessage.isFromMe && !latestMessage.isRead) {
      console.log('[ChatAutopilotConfig] Triggering chat processing for existing unread message');
      // Small delay to ensure the config is saved first
      setTimeout(() => {
        triggerChatProcessing(chatId, latestMessage);
      }, 100);
    } else {
      console.log('[ChatAutopilotConfig] No unread message to process', { hasLatestMessage: !!latestMessage, isFromMe: latestMessage?.isFromMe, isRead: latestMessage?.isRead });
    }
  };

  const handleDisable = () => {
    disable();
    notifyConfigChange();
  };

  const handlePause = () => {
    pause();
  };

  const handleResume = () => {
    resume();
  };

  const formatTimeRemaining = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  if (!agentsLoaded || !configLoaded) {
    return null;
  }

  // No agents - show prompt to create one
  if (agents.length === 0) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon">
            <Bot className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3 text-center py-2">
            <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No Agents Created</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create an agent first to enable autopilot
              </p>
            </div>
            <Link href="/settings/autopilot/agents/new">
              <Button size="sm" className="w-full">
                Create Agent
              </Button>
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Autopilot is active
  if (isEnabled && config) {
    const isPaused = status === 'paused';
    const hasError = status === 'error';
    const isGoalCompleted = status === 'goal-completed';

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasError ? 'destructive' : isPaused ? 'secondary' : 'default'}
            size="icon"
          >
            <Bot className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Autopilot Active</span>
              </div>
              <div className="flex gap-1">
                {!isGoalCompleted && (
                  isPaused ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResume}>
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePause}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDisable}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent:</span>
                <span>{selectedAgent?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <span>{config.mode === 'self-driving' ? 'Self-Driving' : 'Manual Approval'}</span>
              </div>
              {config.mode === 'self-driving' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time remaining:</span>
                  <span className={isExpired ? 'text-destructive' : ''}>
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messages handled:</span>
                <span>{config.messagesHandled}</span>
              </div>
              {hasError && config.lastError && (
                <div className="p-2 bg-destructive/10 rounded text-destructive">
                  {config.lastError}
                </div>
              )}
            </div>

            {/* Quick Settings */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Agent</Label>
                <Select value={config.agentId} onValueChange={setAgent}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id} className="text-xs">
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.mode === 'self-driving' && !isExpired && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Extend time</Label>
                  <Select
                    value={selectedDuration.toString()}
                    onValueChange={(v: string) => {
                      const mins = parseInt(v);
                      setSelectedDuration(mins);
                      setSelfDrivingDuration(mins);
                    }}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Autopilot is not active - show enable UI
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bot className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="font-medium text-sm">Enable Autopilot</span>
          </div>

          <div className="space-y-3">
            {/* Agent Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgent && (
                <p className="text-xs text-muted-foreground">{selectedAgent.goal}</p>
              )}
            </div>

            {/* Mode Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={selectedMode} onValueChange={(v: string) => setSelectedMode(v as AutopilotMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual-approval">Manual Approval</SelectItem>
                  <SelectItem value="self-driving">Self-Driving</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedMode === 'manual-approval' ? 'Review before sending' : 'Fully automatic'}
              </p>
            </div>

            {/* Duration for Self-Driving */}
            {selectedMode === 'self-driving' && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Duration
                </Label>
                <Select
                  value={selectedDuration.toString()}
                  onValueChange={(v: string) => setSelectedDuration(parseInt(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto-disables after this time
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleEnable}
            disabled={!selectedAgentId}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Autopilot
          </Button>

          <Link href="/settings/autopilot/agents" className="block">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              <Settings className="h-3 w-3 mr-1" />
              Manage Agents
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
