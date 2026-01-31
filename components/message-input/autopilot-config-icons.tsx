'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { User, Eye, Lightbulb, Hand, Zap, Clock } from 'lucide-react';
import { AutopilotMode, AutopilotAgent } from '@/lib/types';

interface AutopilotConfigIconsProps {
  agents: AutopilotAgent[];
  selectedAgentId: string;
  selectedMode: AutopilotMode;
  selectedDuration: number;
  onAgentChange: (agentId: string) => void;
  onModeChange: (mode: AutopilotMode) => void;
  onDurationChange: (duration: number) => void;
  isActive: boolean;
}

export function AutopilotConfigIcons({
  agents,
  selectedAgentId,
  selectedMode,
  selectedDuration,
  onAgentChange,
  onModeChange,
  onDurationChange,
  isActive,
}: AutopilotConfigIconsProps) {
  const [durationPopoverOpen, setDurationPopoverOpen] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const getModeLabel = () => {
    switch (selectedMode) {
      case 'observer': return 'Observer';
      case 'suggest': return 'Suggest';
      case 'manual-approval': return 'Manual Approval';
      case 'self-driving': return 'Self-Driving';
      default: return selectedMode;
    }
  };

  const getDurationLabel = () => {
    if (selectedDuration >= 60) {
      const hours = Math.floor(selectedDuration / 60);
      const minutes = selectedDuration % 60;
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }
    return `${selectedDuration}m`;
  };

  return (
    <div className="flex items-center gap-2 min-w-0 flex-shrink">
      {/* Agent Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-normal text-foreground hover:text-foreground/70 transition-colors cursor-pointer overflow-hidden max-w-24">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{selectedAgent?.name || 'Agent'}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => onAgentChange(agent.id)}
            >
              {agent.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-normal text-foreground hover:text-foreground/70 transition-colors cursor-pointer overflow-hidden max-w-28">
          {selectedMode === 'observer' ? (
            <Eye className="h-3 w-3 flex-shrink-0" />
          ) : selectedMode === 'suggest' ? (
            <Lightbulb className="h-3 w-3 flex-shrink-0" />
          ) : selectedMode === 'manual-approval' ? (
            <Hand className="h-3 w-3 flex-shrink-0" />
          ) : (
            <Zap className="h-3 w-3 flex-shrink-0" />
          )}
          <span className="truncate">{getModeLabel()}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onModeChange('observer')}>
            Observer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onModeChange('suggest')}>
            Suggest
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onModeChange('manual-approval')}>
            Manual Approval
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onModeChange('self-driving')}>
            Self-Driving
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Duration Selector (only for self-driving) */}
      {selectedMode === 'self-driving' && (
        <Popover open={durationPopoverOpen} onOpenChange={setDurationPopoverOpen}>
          <PopoverTrigger className="flex items-center gap-1.5 text-xs font-normal text-foreground hover:text-foreground/70 transition-colors cursor-pointer overflow-hidden max-w-12">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{getDurationLabel()}</span>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Duration (minutes)</Label>
              <Input
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
              <p className="text-xs text-muted-foreground">
                Auto-stops after this time
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
