'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AutopilotMode } from '@/lib/types';
import { AutopilotAgent } from '@/lib/types';

interface AutopilotConfigFormProps {
  agents: AutopilotAgent[];
  selectedAgentId: string;
  selectedMode: AutopilotMode;
  selectedDuration: number;
  onAgentChange: (agentId: string) => void;
  onModeChange: (mode: AutopilotMode) => void;
  onDurationChange: (duration: number) => void;
  isActive: boolean;
}

export function AutopilotConfigForm({
  agents,
  selectedAgentId,
  selectedMode,
  selectedDuration,
  onAgentChange,
  onModeChange,
  onDurationChange,
  isActive,
}: AutopilotConfigFormProps) {
  return (
    <div className="space-y-3">
      {/* Agent Selection */}
      <div className="space-y-2">
        <Label htmlFor="agent-select" className="text-xs">Agent</Label>
        <Select
          value={selectedAgentId}
          onValueChange={onAgentChange}
        >
          <SelectTrigger id="agent-select">
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
        <Label htmlFor="mode-select" className="text-xs">Mode</Label>
        <Select
          value={selectedMode}
          onValueChange={(v) => onModeChange(v as AutopilotMode)}
        >
          <SelectTrigger id="mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual-approval">Manual Approval</SelectItem>
            <SelectItem value="self-driving">Self-Driving</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Duration (only for self-driving) */}
      {selectedMode === 'self-driving' && (
        <div className="space-y-2">
          <Label htmlFor="duration-input" className="text-xs">Duration (minutes)</Label>
          <Input
            id="duration-input"
            type="number"
            min="1"
            max="1440"
            value={selectedDuration}
            onChange={(e) => {
              const newDuration = parseInt(e.target.value, 10);
              if (!isNaN(newDuration)) {
                onDurationChange(newDuration);
              }
            }}
            className="h-8"
          />
        </div>
      )}
    </div>
  );
}
