'use client';

import { useMemo, useCallback, useRef } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { Kanban, KanbanBoard, KanbanColumn, KanbanOverlay } from '@/components/ui/kanban';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { MessageCard } from './message-card';
import { ColumnHeader } from './column-header';
import { BeeperMessage, BeeperAttachment, Draft, KanbanCard, KanbanColumns, ColumnId, MediaType } from '@/lib/types';

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Detect media types from attachments
function getMediaTypes(attachments?: BeeperAttachment[], text?: string): MediaType[] {
  const types: MediaType[] = [];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.isGif) {
        if (!types.includes('gif')) types.push('gif');
      } else if (att.isSticker) {
        if (!types.includes('sticker')) types.push('sticker');
      } else if (att.isVoiceNote) {
        if (!types.includes('voice')) types.push('voice');
      } else if (att.type === 'img') {
        if (!types.includes('photo')) types.push('photo');
      } else if (att.type === 'video') {
        if (!types.includes('video')) types.push('video');
      } else if (att.type === 'audio') {
        if (!types.includes('audio')) types.push('audio');
      } else if (att.type === 'unknown' && att.fileName) {
        if (!types.includes('file')) types.push('file');
      }
    }
  }

  // Check for links in text
  if (text && URL_REGEX.test(text)) {
    if (!types.includes('link')) types.push('link');
  }

  return types;
}

// Get media type emoji/label for preview
function getMediaLabel(type: MediaType): string {
  switch (type) {
    case 'photo': return '📷 Photo';
    case 'video': return '🎥 Video';
    case 'audio': return '🎵 Audio';
    case 'voice': return '🎤 Voice message';
    case 'gif': return 'GIF';
    case 'sticker': return '🏷️ Sticker';
    case 'file': return '📎 File';
    case 'link': return '🔗 Link';
    default: return '';
  }
}

// Generate smart preview text that includes media indicators
function generatePreview(text?: string, attachments?: BeeperAttachment[]): string {
  const mediaTypes = getMediaTypes(attachments, text);
  const hasText = text && text.trim().length > 0;

  // If there's text, use it (possibly with media indicator prefix)
  if (hasText) {
    // If there are media attachments, prepend indicator
    if (mediaTypes.length > 0 && !mediaTypes.every(t => t === 'link')) {
      const mediaLabels = mediaTypes
        .filter(t => t !== 'link')
        .map(getMediaLabel)
        .join(', ');
      return `${mediaLabels}: ${text}`;
    }
    return text;
  }

  // No text - generate preview from media types
  if (mediaTypes.length > 0) {
    return mediaTypes.map(getMediaLabel).join(', ');
  }

  return '';
}

interface ChatInfo {
  isGroup: boolean;
  title?: string;
}

interface MessageBoardProps {
  unreadMessages: BeeperMessage[];
  autopilotMessages?: BeeperMessage[];
  drafts: Draft[];
  sentMessages: BeeperMessage[];
  archivedMessages?: BeeperMessage[];
  showArchivedColumn?: boolean;
  avatars?: Record<string, string>;
  chatInfo?: Record<string, ChatInfo>;
  onCardClick: (card: KanbanCard) => void;
  onMoveToColumn: (card: KanbanCard, fromColumn: ColumnId, toColumn: ColumnId) => void;
  onArchive?: (card: KanbanCard) => void;
  onUnarchive?: (card: KanbanCard) => void;
  onHide?: (card: KanbanCard) => void;
  onDeleteDraft?: (card: KanbanCard) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onGenerateAllDrafts?: () => void;
  isGeneratingDrafts?: boolean;
  generatingProgress?: { current: number; total: number };
  onCancelGeneration?: () => void;
  onSendAllDrafts?: () => void;
  isSendingAllDrafts?: boolean;
  sendingProgress?: { current: number; total: number };
  onCancelSending?: () => void;
}

function messageToCard(
  message: BeeperMessage,
  avatars?: Record<string, string>,
  chatInfo?: Record<string, ChatInfo>
): KanbanCard {
  const info = chatInfo?.[message.chatId];
  // Use chat title (group name or contact name) if available, fallback to sender name
  const title = info?.title || message.senderName;
  // Generate smart preview with media indicators
  const mediaTypes = getMediaTypes(message.attachments, message.text);
  const preview = generatePreview(message.text, message.attachments);

  return {
    id: message.id,
    type: 'message',
    message,
    title,
    preview,
    timestamp: message.timestamp,
    platform: message.platform || 'unknown',
    // For groups: no avatar (will show initials from group title)
    // For single chats: use participant avatar
    avatarUrl: info?.isGroup ? undefined : (avatars?.[message.chatId] || message.senderAvatarUrl),
    unreadCount: message.unreadCount,
    isGroup: info?.isGroup,
    mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
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
  autopilotMessages = [],
  drafts,
  sentMessages,
  archivedMessages = [],
  showArchivedColumn = false,
  avatars,
  chatInfo,
  onCardClick,
  onMoveToColumn,
  onArchive,
  onUnarchive,
  onHide,
  onDeleteDraft,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onGenerateAllDrafts,
  isGeneratingDrafts,
  generatingProgress,
  onCancelGeneration,
  onSendAllDrafts,
  isSendingAllDrafts,
  sendingProgress,
  onCancelSending,
}: MessageBoardProps) {
  // Convert data to kanban format - derive directly from props
  const columns: KanbanColumns = useMemo(() => ({
    unread: unreadMessages.map(m => messageToCard(m, avatars, chatInfo)),
    autopilot: autopilotMessages.map(m => messageToCard(m, avatars, chatInfo)),
    drafts: drafts.map(draftToCard),
    sent: sentMessages.slice(0, 20).map(m => messageToCard(m, avatars, chatInfo)), // Limit sent messages
    archived: archivedMessages.slice(0, 20).map(m => messageToCard(m, avatars, chatInfo)),
  }), [unreadMessages, autopilotMessages, drafts, sentMessages, archivedMessages, avatars, chatInfo]);

  // Determine which columns to show
  const visibleColumns: ColumnId[] = useMemo(() => {
    const cols: ColumnId[] = ['unread'];
    // Show autopilot column if there are any autopilot messages
    if (autopilotMessages.length > 0) {
      cols.push('autopilot');
    }
    cols.push('drafts', 'sent');
    if (showArchivedColumn) {
      cols.push('archived');
    }
    return cols;
  }, [showArchivedColumn, autopilotMessages.length]);

  // Track starting column for drag operations
  const dragStartColumnRef = useRef<ColumnId | null>(null);

  // Find which column contains a card by its id
  const findColumnForCard = useCallback((cardId: string): ColumnId | null => {
    if (columns.unread.some(c => c.id === cardId)) return 'unread';
    if (columns.autopilot.some(c => c.id === cardId)) return 'autopilot';
    if (columns.drafts.some(c => c.id === cardId)) return 'drafts';
    if (columns.sent.some(c => c.id === cardId)) return 'sent';
    if (columns.archived.some(c => c.id === cardId)) return 'archived';
    return null;
  }, [columns]);

  // Handle drag end to detect cross-column moves
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const startColumn = dragStartColumnRef.current;

    if (!over || !startColumn) {
      dragStartColumnRef.current = null;
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine the target column - it could be the column id itself or an item in the column
    let targetColumn: ColumnId | null = null;
    if (['unread', 'autopilot', 'drafts', 'sent', 'archived'].includes(overId)) {
      targetColumn = overId as ColumnId;
    } else {
      // Find which column the over item is in
      targetColumn = findColumnForCard(overId);
    }

    // If we moved to a different column (specifically from unread to drafts)
    if (targetColumn && startColumn !== targetColumn && startColumn === 'unread' && targetColumn === 'drafts') {
      const card = columns.unread.find(c => c.id === activeId);
      if (card) {
        onMoveToColumn(card, startColumn, targetColumn);
      }
    }

    dragStartColumnRef.current = null;
  }, [columns, findColumnForCard, onMoveToColumn]);

  // Handle drag start to track source column
  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    const cardId = event.active.id as string;
    dragStartColumnRef.current = findColumnForCard(cardId);
  }, [findColumnForCard]);

  // Allow visual updates during drag but don't persist changes
  const handleValueChange = useCallback(() => {
    // Visual updates are handled by dnd-kit internally
    // Actual data changes happen via onMoveToColumn in handleDragEnd
  }, []);

  return (
    <Kanban
      value={columns}
      onValueChange={handleValueChange}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      getItemValue={(card) => card.id}
    >
      <KanbanBoard className="w-fit h-full gap-0">
        {visibleColumns.map((columnId) => (
          <KanbanColumn
            key={columnId}
            value={columnId}
            className="w-auto shrink-0 flex-col h-full !bg-transparent !border-0 !rounded-none !p-0 overflow-hidden"
          >
            <ColumnHeader
                  columnId={columnId}
                  count={columns[columnId].length}
                  onGenerateAllDrafts={columnId === 'unread' ? onGenerateAllDrafts : undefined}
                  isGenerating={columnId === 'unread' ? isGeneratingDrafts : undefined}
                  generatingProgress={columnId === 'unread' ? generatingProgress : undefined}
                  onCancelGeneration={columnId === 'unread' ? onCancelGeneration : undefined}
                  onSendAllDrafts={columnId === 'drafts' ? onSendAllDrafts : undefined}
                  isSendingAll={columnId === 'drafts' ? isSendingAllDrafts : undefined}
                  sendingProgress={columnId === 'drafts' ? sendingProgress : undefined}
                  onCancelSending={columnId === 'drafts' ? onCancelSending : undefined}
                />
            <div className="relative flex-1 h-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-2 p-4 pb-20">
                  {columns[columnId].length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
                      {columnId === 'unread' && 'No unread messages'}
                      {columnId === 'autopilot' && 'No chats on autopilot'}
                      {columnId === 'drafts' && 'Drag messages here to create drafts'}
                      {columnId === 'sent' && 'No sent messages'}
                      {columnId === 'archived' && 'No archived chats'}
                    </div>
                  ) : (
                    <>
                      {columns[columnId].map((card) => (
                        <MessageCard
                          key={card.id}
                          card={card}
                          onClick={() => onCardClick(card)}
                          onArchive={columnId !== 'archived' ? onArchive : undefined}
                          onUnarchive={columnId === 'archived' ? onUnarchive : undefined}
                          onHide={onHide}
                          onDeleteDraft={onDeleteDraft}
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
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={1.5} />
                              Loading...
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" strokeWidth={1.5} />
                              Load More Messages
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              {/* Bottom gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            </div>
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
