'use client';

import { useMemo, useCallback, useRef } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { Kanban, KanbanBoard, KanbanColumn, KanbanOverlay } from '@/components/ui/kanban';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { MessageCard } from './message-card';
import { ColumnHeader } from './column-header';
import { BeeperMessage, BeeperAttachment, Draft, KanbanCard, KanbanColumns, ColumnId, MediaType, KanbanGroupBy, StatusColumnId } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';

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

// Get media type label for preview (no emoji - icon shown separately)
function getMediaLabel(type: MediaType): string {
  switch (type) {
    case 'photo': return 'Photo';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'voice': return 'Voice message';
    case 'gif': return 'GIF';
    case 'sticker': return 'Sticker';
    case 'file': return 'File';
    case 'link': return 'Link';
    default: return '';
  }
}

// Generate smart preview text (media icons shown separately in card)
function generatePreview(text?: string, attachments?: BeeperAttachment[]): string {
  const mediaTypes = getMediaTypes(attachments, text);
  const hasText = text && text.trim().length > 0;

  // If there's text, use it directly (icon shown separately)
  if (hasText) {
    return text;
  }

  // No text - show media type label only
  if (mediaTypes.length > 0) {
    return mediaTypes.map(getMediaLabel).join(', ');
  }

  return '';
}

interface ChatInfo {
  isGroup: boolean;
  title?: string;
}

// Create a stable key for a message that changes only when display-relevant fields change
function getMessageKey(message: BeeperMessage): string {
  return `${message.id}|${message.timestamp}|${message.text}|${message.unreadCount}|${message.isRead}`;
}

// Create a stable key for a list of messages
function getMessagesKey(messages: BeeperMessage[]): string {
  return messages.map(m => getMessageKey(m)).join(';;');
}

// Create a stable key for drafts
function getDraftsKey(drafts: Draft[]): string {
  return drafts.map(d => `${d.id}|${d.updatedAt}|${d.draftText}`).join(';;');
}

interface MessageBoardProps {
  groupBy?: KanbanGroupBy;
  unreadMessages: BeeperMessage[];
  autopilotMessages?: BeeperMessage[];
  drafts: Draft[];
  sentMessages: BeeperMessage[];
  archivedMessages?: BeeperMessage[];
  showArchivedColumn?: boolean;
  onToggleArchived?: () => void;
  avatars?: Record<string, string>;
  chatInfo?: Record<string, ChatInfo>;
  onCardClick: (card: KanbanCard) => void;
  onMoveToColumn?: (card: KanbanCard, fromColumn: ColumnId, toColumn: ColumnId) => void;
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
  aiEnabled?: boolean;
}

// Check if a column ID is a status column
function isStatusColumnId(id: string): id is StatusColumnId {
  return ['unread', 'autopilot', 'drafts', 'sent', 'archived'].includes(id);
}

// Compute platform-based columns from messages and drafts
function computePlatformColumns(
  unreadMessages: BeeperMessage[],
  drafts: Draft[],
  sentMessages: BeeperMessage[],
  avatars?: Record<string, string>,
  chatInfo?: Record<string, ChatInfo>
): KanbanColumns {
  const columns: KanbanColumns = {};

  // Helper to add a card to a platform column
  const addToColumn = (platform: string, card: KanbanCard) => {
    const normalizedPlatform = platform.toLowerCase() || 'unknown';
    if (!columns[normalizedPlatform]) {
      columns[normalizedPlatform] = [];
    }
    columns[normalizedPlatform].push(card);
  };

  // Add unread messages
  for (const message of unreadMessages) {
    const card = messageToCard(message, avatars, chatInfo);
    addToColumn(card.platform, card);
  }

  // Add sent messages
  for (const message of sentMessages.slice(0, 50)) {
    const card = messageToCard(message, avatars, chatInfo);
    addToColumn(card.platform, card);
  }

  // Add drafts
  for (const draft of drafts) {
    const card = draftToCard(draft);
    addToColumn(card.platform, card);
  }

  // Sort each column by timestamp (most recent first)
  for (const platformId of Object.keys(columns)) {
    columns[platformId].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  return columns;
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
  groupBy = 'status',
  unreadMessages,
  autopilotMessages = [],
  drafts,
  sentMessages,
  archivedMessages = [],
  showArchivedColumn = true,
  onToggleArchived,
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
  aiEnabled = true,
}: MessageBoardProps) {
  const isPlatformMode = groupBy === 'platform';
  // Store previous column arrays to reuse when content hasn't changed
  const prevColumnsRef = useRef<KanbanColumns>({
    unread: [],
    autopilot: [],
    drafts: [],
    sent: [],
    archived: [],
  });

  // Store previous keys to detect changes
  const prevKeysRef = useRef({
    unread: '',
    autopilot: '',
    drafts: '',
    sent: '',
    archived: '',
  });

  // Compute stable keys for each column's data
  const currentKeys = useMemo(() => ({
    unread: getMessagesKey(unreadMessages),
    autopilot: getMessagesKey(autopilotMessages),
    drafts: getDraftsKey(drafts),
    sent: getMessagesKey(sentMessages.slice(0, 20)),
    archived: getMessagesKey(archivedMessages.slice(0, 20)),
  }), [unreadMessages, autopilotMessages, drafts, sentMessages, archivedMessages]);

  // Only rebuild column arrays when their content actually changes
  const columns: KanbanColumns = useMemo(() => {
    // Platform mode: group all messages by platform
    if (isPlatformMode) {
      return computePlatformColumns(unreadMessages, drafts, sentMessages, avatars, chatInfo);
    }

    // Status mode: use existing logic with optimization
    // Check if ANY column changed
    const unreadChanged = currentKeys.unread !== prevKeysRef.current.unread;
    const autopilotChanged = currentKeys.autopilot !== prevKeysRef.current.autopilot;
    const draftsChanged = currentKeys.drafts !== prevKeysRef.current.drafts;
    const sentChanged = currentKeys.sent !== prevKeysRef.current.sent;
    const archivedChanged = currentKeys.archived !== prevKeysRef.current.archived;

    // If nothing changed, return the exact same object reference
    if (!unreadChanged && !autopilotChanged && !draftsChanged && !sentChanged && !archivedChanged) {
      return prevColumnsRef.current;
    }

    // Build new columns object, reusing unchanged column arrays
    const newColumns: KanbanColumns = {
      unread: unreadChanged
        ? unreadMessages.map(m => messageToCard(m, avatars, chatInfo))
        : prevColumnsRef.current.unread || [],
      autopilot: autopilotChanged
        ? autopilotMessages.map(m => messageToCard(m, avatars, chatInfo))
        : prevColumnsRef.current.autopilot || [],
      drafts: draftsChanged
        ? drafts.map(draftToCard)
        : prevColumnsRef.current.drafts || [],
      sent: sentChanged
        ? sentMessages.slice(0, 20).map(m => messageToCard(m, avatars, chatInfo))
        : prevColumnsRef.current.sent || [],
      archived: archivedChanged
        ? archivedMessages.slice(0, 20).map(m => messageToCard(m, avatars, chatInfo))
        : prevColumnsRef.current.archived || [],
    };

    // Update the keys for changed columns
    if (unreadChanged) prevKeysRef.current.unread = currentKeys.unread;
    if (autopilotChanged) prevKeysRef.current.autopilot = currentKeys.autopilot;
    if (draftsChanged) prevKeysRef.current.drafts = currentKeys.drafts;
    if (sentChanged) prevKeysRef.current.sent = currentKeys.sent;
    if (archivedChanged) prevKeysRef.current.archived = currentKeys.archived;

    prevColumnsRef.current = newColumns;
    return newColumns;
  }, [isPlatformMode, currentKeys, unreadMessages, autopilotMessages, drafts, sentMessages, archivedMessages, avatars, chatInfo]);

  // Determine which columns to show
  const visibleColumns: ColumnId[] = useMemo(() => {
    // Platform mode: show platforms sorted by message count (most active first)
    if (isPlatformMode) {
      return Object.entries(columns)
        .filter(([_, cards]) => cards.length > 0)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([platformId]) => platformId);
    }

    // Status mode: show fixed columns
    const cols: ColumnId[] = ['unread'];
    // Show autopilot column if AI is enabled and there are any autopilot messages
    if (aiEnabled && autopilotMessages.length > 0) {
      cols.push('autopilot');
    }
    // Always show drafts column (manual drafts work without AI)
    cols.push('drafts');
    cols.push('sent');
    if (showArchivedColumn) {
      cols.push('archived');
    }
    return cols;
  }, [isPlatformMode, columns, showArchivedColumn, autopilotMessages.length, aiEnabled]);

  // Track starting column for drag operations
  const dragStartColumnRef = useRef<ColumnId | null>(null);

  // Find which column contains a card by its id
  const findColumnForCard = useCallback((cardId: string): ColumnId | null => {
    // Search through all columns (works for both status and platform modes)
    for (const [columnId, cards] of Object.entries(columns)) {
      if (cards.some(c => c.id === cardId)) {
        return columnId;
      }
    }
    return null;
  }, [columns]);

  // Handle drag end to detect cross-column moves
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const startColumn = dragStartColumnRef.current;

    // In platform mode, disable cross-column drag entirely
    if (isPlatformMode) {
      dragStartColumnRef.current = null;
      return;
    }

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
    if (targetColumn && startColumn !== targetColumn && startColumn === 'unread' && targetColumn === 'drafts' && onMoveToColumn) {
      const card = columns.unread?.find(c => c.id === activeId);
      if (card) {
        onMoveToColumn(card, startColumn, targetColumn);
      }
    }

    dragStartColumnRef.current = null;
  }, [isPlatformMode, columns, findColumnForCard, onMoveToColumn]);

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
                  groupBy={groupBy}
                  count={(columns[columnId] || []).length}
                  onGenerateAllDrafts={columnId === 'unread' ? onGenerateAllDrafts : undefined}
                  isGenerating={columnId === 'unread' ? isGeneratingDrafts : undefined}
                  generatingProgress={columnId === 'unread' ? generatingProgress : undefined}
                  onCancelGeneration={columnId === 'unread' ? onCancelGeneration : undefined}
                  onSendAllDrafts={columnId === 'drafts' ? onSendAllDrafts : undefined}
                  isSendingAll={columnId === 'drafts' ? isSendingAllDrafts : undefined}
                  sendingProgress={columnId === 'drafts' ? sendingProgress : undefined}
                  onCancelSending={columnId === 'drafts' ? onCancelSending : undefined}
                  onToggleArchived={columnId === 'archived' ? onToggleArchived : undefined}
                />
            <div className="relative flex-1 h-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-2 px-4 pt-0 pb-20">
                  {(columns[columnId] || []).length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
                      {/* Status mode empty states */}
                      {!isPlatformMode && columnId === 'unread' && 'No unread messages'}
                      {!isPlatformMode && columnId === 'autopilot' && 'No chats on autopilot'}
                      {!isPlatformMode && columnId === 'drafts' && 'Drag messages here to create drafts'}
                      {!isPlatformMode && columnId === 'sent' && 'No sent messages'}
                      {!isPlatformMode && columnId === 'archived' && 'No archived chats'}
                      {/* Platform mode empty state */}
                      {isPlatformMode && `No messages from ${getPlatformInfo(columnId).name}`}
                    </div>
                  ) : (
                    <>
                      {(columns[columnId] || []).map((card) => (
                        <MessageCard
                          key={card.id}
                          card={card}
                          onClick={() => onCardClick(card)}
                          onArchive={!isPlatformMode && columnId !== 'archived' ? onArchive : undefined}
                          onUnarchive={!isPlatformMode && columnId === 'archived' ? onUnarchive : undefined}
                          onHide={onHide}
                          onDeleteDraft={onDeleteDraft}
                        />
                      ))}
                      {!isPlatformMode && columnId === 'unread' && hasMore && onLoadMore && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={onLoadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
                              Loading...
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" strokeWidth={2} />
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
