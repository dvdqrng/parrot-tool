'use client';

import { Inbox, PenLine, SendHorizontal, Archive, LucideIcon, Sparkles, Square } from 'lucide-react';
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
}

const columnConfig: Record<ColumnId, { title: string; icon: LucideIcon }> = {
  unread: {
    title: 'Unread',
    icon: Inbox,
  },
  drafts: {
    title: 'Drafts',
    icon: PenLine,
  },
  sent: {
    title: 'Sent',
    icon: SendHorizontal,
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
}: ColumnHeaderProps) {
  const config = columnConfig[columnId];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground" />
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
            <Square className="!h-2.5 !w-2.5 mr-1" />
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
            <Sparkles className="!h-2.5 !w-2.5 mr-1" />
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
            <Square className="!h-2.5 !w-2.5 mr-1" />
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
            <SendHorizontal className="!h-2.5 !w-2.5 mr-1" />
            Send All
          </Button>
        )
      )}
    </div>
  );
}
