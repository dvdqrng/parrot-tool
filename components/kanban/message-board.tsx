'use client';

import { useMemo, useCallback } from 'react';
import { Kanban, KanbanBoard, KanbanColumn, KanbanOverlay } from '@/components/ui/kanban';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { MessageCard } from './message-card';
import { ColumnHeader } from './column-header';
import { BeeperMessage, Draft, KanbanCard, KanbanColumns, ColumnId } from '@/lib/types';

interface ChatInfo {
  isGroup: boolean;
  title?: string;
}

interface MessageBoardProps {
  unreadMessages: BeeperMessage[];
  drafts: Draft[];
  sentMessages: BeeperMessage[];
  avatars?: Record<string, string>;
  chatInfo?: Record<string, ChatInfo>;
  onCardClick: (card: KanbanCard) => void;
  onMoveToColumn: (card: KanbanCard, fromColumn: ColumnId, toColumn: ColumnId) => void;
  onArchive?: (card: KanbanCard) => void;
  onHide?: (card: KanbanCard) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function messageToCard(
  message: BeeperMessage,
  avatars?: Record<string, string>,
  chatInfo?: Record<string, ChatInfo>
): KanbanCard {
  const info = chatInfo?.[message.chatId];
  // Use chat title (group name or contact name) if available, fallback to sender name
  const title = info?.title || message.senderName;
  return {
    id: message.id,
    type: 'message',
    message,
    title,
    preview: message.text,
    timestamp: message.timestamp,
    platform: message.platform || 'unknown',
    // For groups: no avatar (will show initials from group title)
    // For single chats: use participant avatar
    avatarUrl: info?.isGroup ? undefined : (avatars?.[message.chatId] || message.senderAvatarUrl),
    unreadCount: message.unreadCount,
    isGroup: info?.isGroup,
  };
}

function draftToCard(draft: Draft): KanbanCard {
  return {
    id: draft.id,
    type: 'draft',
    draft,
    title: `Reply to ${draft.recipientName}`,
    preview: draft.draftText || '(empty draft)',
    timestamp: draft.updatedAt,
    platform: draft.platform,
    avatarUrl: draft.avatarUrl,
    isGroup: draft.isGroup,
  };
}

export function MessageBoard({
  unreadMessages,
  drafts,
  sentMessages,
  avatars,
  chatInfo,
  onCardClick,
  onMoveToColumn,
  onArchive,
  onHide,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: MessageBoardProps) {
  // Convert data to kanban format - derive directly from props
  const columns: KanbanColumns = useMemo(() => ({
    unread: unreadMessages.map(m => messageToCard(m, avatars, chatInfo)),
    drafts: drafts.map(draftToCard),
    sent: sentMessages.slice(0, 20).map(m => messageToCard(m, avatars, chatInfo)), // Limit sent messages
  }), [unreadMessages, drafts, sentMessages, avatars, chatInfo]);

  const handleValueChange = useCallback((newColumns: Record<string, KanbanCard[]>) => {
    const typedColumns = newColumns as KanbanColumns;

    // Find what moved
    const oldUnreadIds = new Set(columns.unread.map(c => c.id));
    const oldDraftIds = new Set(columns.drafts.map(c => c.id));

    // Check for cards that moved TO drafts
    for (const card of typedColumns.drafts) {
      if (oldUnreadIds.has(card.id) && !oldDraftIds.has(card.id)) {
        onMoveToColumn(card, 'unread', 'drafts');
      }
    }
  }, [columns, onMoveToColumn]);

  return (
    <Kanban
      value={columns}
      onValueChange={handleValueChange}
      getItemValue={(card) => card.id}
    >
      <KanbanBoard className="h-full gap-0">
        {(['unread', 'drafts', 'sent'] as ColumnId[]).map((columnId, index) => (
          <KanbanColumn
            key={columnId}
            value={columnId}
            className={`w-80 min-w-80 max-w-80 shrink-0 flex-col h-full !bg-transparent !border-0 !rounded-none !p-0 overflow-hidden ${index > 0 ? 'border-l !border-l border-border' : ''}`}
          >
            <ColumnHeader columnId={columnId} count={columns[columnId].length} />
            <ScrollArea className="flex-1 h-0 min-h-0">
              <div className="flex flex-col gap-2 p-4 pr-4" style={{ width: '288px' }}>
                {columns[columnId].length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
                    {columnId === 'unread' && 'No unread messages'}
                    {columnId === 'drafts' && 'Drag messages here to create drafts'}
                    {columnId === 'sent' && 'No sent messages'}
                  </div>
                ) : (
                  <>
                    {columns[columnId].map((card) => (
                      <MessageCard
                        key={card.id}
                        card={card}
                        onClick={() => onCardClick(card)}
                        onArchive={onArchive}
                        onHide={onHide}
                      />
                    ))}
                    {columnId === 'unread' && hasMore && onLoadMore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-2 h-4 w-4" />
                            Load More Messages
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </KanbanColumn>
        ))}
      </KanbanBoard>
      <KanbanOverlay>
        {({ value, variant }) => {
          if (variant === 'item') {
            const card = Object.values(columns)
              .flat()
              .find((c) => c.id === value);
            if (card) {
              return <MessageCard card={card} />;
            }
          }
          return null;
        }}
      </KanbanOverlay>
    </Kanban>
  );
}
