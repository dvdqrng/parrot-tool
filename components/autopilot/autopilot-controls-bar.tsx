'use client';

import { useState } from 'react';
import { Pause, Play, Square, Settings, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutopilot } from '@/contexts/autopilot-context';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChatAutopilotConfig, AutopilotAgent, AutopilotMode } from '@/lib/types';
import { toast } from 'sonner';

interface AutopilotControlsBarProps {
  chatId: string;
  config: ChatAutopilotConfig;
  agents: AutopilotAgent[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSetAgent: (agentId: string) => void;
  onSetMode: (mode: AutopilotMode, durationMinutes?: number) => void;
  onExtendTime: (additionalMinutes: number) => void;
}

export function AutopilotControlsBar({
  chatId,
  config,
  agents,
  onPause,
  onResume,
  onStop,
  onSetAgent,
  onSetMode,
  onExtendTime,
}: AutopilotControlsBarProps) {
  const { notifyConfigChange } = useAutopilot();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(config.agentId);
  const [selectedMode, setSelectedMode] = useState<AutopilotMode>(config.mode);
  const [durationMinutes, setDurationMinutes] = useState(
    config.selfDrivingDurationMinutes?.toString() || '30'
  );

  const handleSaveConfig = () => {
    // Update agent if changed
    if (selectedAgentId !== config.agentId) {
      onSetAgent(selectedAgentId);
    }

    // Update mode if changed
    if (selectedMode !== config.mode) {
      const duration = selectedMode === 'self-driving' ? parseInt(durationMinutes, 10) : undefined;
      onSetMode(selectedMode, duration);
    } else if (selectedMode === 'self-driving' && durationMinutes !== config.selfDrivingDurationMinutes?.toString()) {
      // Update duration if mode is same but duration changed
      onSetMode(selectedMode, parseInt(durationMinutes, 10));
    }

    notifyConfigChange();
    setConfigOpen(false);
    toast.success('Autopilot configuration updated');
  };

  const handleStop = () => {
    if (confirm('Stop autopilot for this chat?')) {
      onStop();
      notifyConfigChange();
    }
  };

  const handleExtendTime = () => {
    onExtendTime(30); // Extend by 30 minutes
    notifyConfigChange();
    toast.success('Extended by 30 minutes');
  };

  const handlePause = () => {
    onPause();
    notifyConfigChange();
  };

  const handleResume = () => {
    onResume();
    notifyConfigChange();
  };

  const isPaused = config.status === 'paused';
  const isActive = config.status === 'active';
  const isSelfDriving = config.mode === 'self-driving';
  const canExtend = isSelfDriving && config.selfDrivingExpiresAt && !isPaused;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Pause/Resume Button */}
      {isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
        >
          <Pause className="h-4 w-4 mr-2" strokeWidth={2} />
          Pause
        </Button>
      )}

      {isPaused && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
        >
          <Play className="h-4 w-4 mr-2" strokeWidth={2} />
          Resume
        </Button>
      )}

      {/* Stop Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleStop}
      >
        <Square className="h-4 w-4 mr-2" strokeWidth={2} />
        Stop
      </Button>

      {/* Configure Popover */}
      <Popover open={configOpen} onOpenChange={setConfigOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" strokeWidth={2} />
            Configure
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Autopilot Configuration</h4>
              <p className="text-xs text-muted-foreground">
                Configure the agent and mode for this chat
              </p>
            </div>

            {/* Agent Selector */}
            <div className="space-y-2">
              <Label htmlFor="agent" className="text-xs">Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger id="agent">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="mode" className="text-xs">Mode</Label>
              <Select value={selectedMode} onValueChange={(v: string) => setSelectedMode(v as AutopilotMode)}>
                <SelectTrigger id="mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual-approval">Manual Approval</SelectItem>
                  <SelectItem value="self-driving">Self-Driving</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration Input (only for self-driving) */}
            {selectedMode === 'self-driving' && (
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-xs">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="h-8"
                />
              </div>
            )}

            {/* Save Button */}
            <Button onClick={handleSaveConfig} size="sm" className="w-full">
              Save Changes
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Extend Time Button (only for self-driving) */}
      {canExtend && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleExtendTime}
        >
          <Clock className="h-4 w-4 mr-2" strokeWidth={2} />
          +30 min
        </Button>
      )}
    </div>
  );
}
