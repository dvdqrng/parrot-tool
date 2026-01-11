'use client';

import { Inbox, Edit, Send, Archive, Brain, Sparkles, Square, LucideIcon, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColumnId, StatusColumnId, KanbanGroupBy } from '@/lib/types';
import { PlatformIcon } from '@/components/platform-icon';
import { getPlatformInfo } from '@/lib/beeper-client';

interface ColumnHeaderProps {
  columnId: ColumnId;
  groupBy?: KanbanGroupBy;
  count: number;
  onGenerateAllDrafts?: () => void;
  isGenerating?: boolean;
  generatingProgress?: { current: number; total: number };
  onCancelGeneration?: () => void;
  onSendAllDrafts?: () => void;
  isSendingAll?: boolean;
  sendingProgress?: { current: number; total: number };
  onCancelSending?: () => void;
  onToggleArchived?: () => void;
}

// Status column configuration
const statusColumnConfig: Record<StatusColumnId, { title: string; icon: LucideIcon }> = {
  unread: {
    title: 'Unread',
    icon: Inbox,
  },
  autopilot: {
    title: 'Autopilot',
    icon: Brain,
  },
  drafts: {
    title: 'Drafts',
    icon: Edit,
  },
  sent: {
    title: 'Sent',
    icon: Send,
  },
  archived: {
    title: 'Archived',
    icon: Archive,
  },
};

// Check if a column ID is a status column
function isStatusColumnId(id: string): id is StatusColumnId {
  return ['unread', 'autopilot', 'drafts', 'sent', 'archived'].includes(id);
}

export function ColumnHeader({
  columnId,
  groupBy = 'status',
  count,
  onGenerateAllDrafts,
  isGenerating,
  generatingProgress,
  onCancelGeneration,
  onSendAllDrafts,
  isSendingAll,
  sendingProgress,
  onCancelSending,
  onToggleArchived,
}: ColumnHeaderProps) {
  // Determine if this is a status column or platform column
  const isStatusColumn = isStatusColumnId(columnId);
  const isPlatformMode = groupBy === 'platform';

  // Get title and icon based on column type
  let title: string;
  let IconComponent: React.ReactNode;

  if (isStatusColumn && !isPlatformMode) {
    // Status mode with status column
    const config = statusColumnConfig[columnId];
    title = config.title;
    IconComponent = <config.icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />;
  } else {
    // Platform mode - use platform info
    const platformInfo = getPlatformInfo(columnId);
    title = platformInfo.name;
    IconComponent = <PlatformIcon platform={columnId} className="h-4 w-4" />;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        {IconComponent}
        <h3 className="text-xs font-medium">{title}</h3>
      </div>
      {/* Status-specific actions - only show in status mode */}
      {!isPlatformMode && columnId === 'unread' && count > 0 && onGenerateAllDrafts && (
        isGenerating ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onCancelGeneration}
          >
            <Square className="h-4 w-4 mr-1" strokeWidth={2} />
            {generatingProgress ? `${generatingProgress.current}/${generatingProgress.total}` : 'Stop'}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onGenerateAllDrafts}
            title="Generate drafts for all unread messages"
          >
            Draft All
          </Button>
        )
      )}
      {!isPlatformMode && columnId === 'drafts' && count > 0 && onSendAllDrafts && (
        isSendingAll ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onCancelSending}
          >
            <Square className="h-4 w-4 mr-1" strokeWidth={2} />
            {sendingProgress ? `${sendingProgress.current}/${sendingProgress.total}` : 'Stop'}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onSendAllDrafts}
            title="Send all drafts"
          >
            Send All
          </Button>
        )
      )}
      {!isPlatformMode && columnId === 'archived' && onToggleArchived && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onToggleArchived}
          title="Hide archived column"
        >
          <EyeOff className="h-3 w-3 mr-1" strokeWidth={2} />
          Hide
        </Button>
      )}
    </div>
  );
}
