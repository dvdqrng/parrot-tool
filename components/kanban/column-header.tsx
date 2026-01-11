'use client';

import { Inbox, Edit, Send, Archive, Brain, Sparkles, Square, LucideIcon, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColumnId } from '@/lib/types';

interface ColumnHeaderProps {
  columnId: ColumnId;
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

const columnConfig: Record<ColumnId, { title: string; icon: LucideIcon }> = {
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

export function ColumnHeader({
  columnId,
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
  const config = columnConfig[columnId];

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <config.icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <h3 className="text-xs font-medium">{config.title}</h3>
      </div>
      {columnId === 'unread' && count > 0 && onGenerateAllDrafts && (
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
      {columnId === 'drafts' && count > 0 && onSendAllDrafts && (
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
      {columnId === 'archived' && onToggleArchived && (
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
