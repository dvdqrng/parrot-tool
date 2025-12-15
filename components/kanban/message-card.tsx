'use client';

import React, { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Users, Archive, ArchiveRestore, EyeOff, Send, Trash2, Image, Video, Music, Mic, FileText, Link2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { KanbanItem } from '@/components/ui/kanban';
import { KanbanCard, MediaType } from '@/lib/types';
import { PlatformIcon } from '@/components/platform-icon';
import { AutopilotStatusBadge } from '@/components/autopilot/autopilot-status-badge';
import { getChatAutopilotConfig, getAutopilotAgentById } from '@/lib/storage';

// Get icon for media type
function MediaIcon({ type, className }: { type: MediaType; className?: string }) {
  switch (type) {
    case 'photo':
    case 'gif':
    case 'sticker':
      return <Image className={className} strokeWidth={1.5} />;
    case 'video':
      return <Video className={className} strokeWidth={1.5} />;
    case 'audio':
      return <Music className={className} strokeWidth={1.5} />;
    case 'voice':
      return <Mic className={className} strokeWidth={1.5} />;
    case 'file':
      return <FileText className={className} strokeWidth={1.5} />;
    case 'link':
      return <Link2 className={className} strokeWidth={1.5} />;
    default:
      return null;
  }
}

interface MessageCardProps {
  card: KanbanCard;
  onClick?: () => void;
  onArchive?: (card: KanbanCard) => void;
  onUnarchive?: (card: KanbanCard) => void;
  onHide?: (card: KanbanCard) => void;
  onSend?: (card: KanbanCard) => void;
  onDeleteDraft?: (card: KanbanCard) => void;
}

// Convert file:// URLs to proxied API URLs
function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function MessageCardComponent({ card, onClick, onArchive, onUnarchive, onHide, onSend, onDeleteDraft }: MessageCardProps) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(card.timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  // Get autopilot config for this chat
  const chatId = card.message?.chatId || card.draft?.chatId;
  const autopilotConfig = chatId ? getChatAutopilotConfig(chatId) : null;
  const autopilotAgent = autopilotConfig?.agentId ? getAutopilotAgentById(autopilotConfig.agentId) : null;

  // Calculate time remaining for self-driving mode
  const getTimeRemaining = () => {
    if (!autopilotConfig?.selfDrivingExpiresAt) return null;
    const expiresAt = new Date(autopilotConfig.selfDrivingExpiresAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return remaining > 0 ? remaining : null;
  };

  const initials = card.title
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const unreadCount = card.unreadCount ?? 0;
  const avatarSrc = getAvatarSrc(card.avatarUrl);

  const handleArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onArchive?.(card);
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onUnarchive?.(card);
  };

  const handleHide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onHide?.(card);
  };

  const handleSend = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onSend?.(card);
  };

  const handleDeleteDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onDeleteDraft?.(card);
  };

  const stopAllPropagation = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  const isDraft = card.type === 'draft' && card.draft;

  // For drafts, show the original message and the draft text
  if (isDraft) {
    return (
      <KanbanItem value={card.id} asHandle className="w-80">
        <div
          className="group flex gap-3 p-3 cursor-pointer rounded-2xl bg-card hover:shadow-md transition-all overflow-hidden"
          onClick={onClick}
        >
          <div className="relative shrink-0 self-start">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarSrc} alt={card.title} className="object-cover" />
              <AvatarFallback className="text-xs">
                {card.isGroup ? <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> : initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              <PlatformIcon platform={card.platform} className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between h-5">
              <span className="truncate text-xs font-medium">{card.title}</span>
              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onPointerDownCapture={stopAllPropagation}
                onMouseDownCapture={stopAllPropagation}
                onTouchStartCapture={stopAllPropagation}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full hover:bg-muted"
                  onClick={handleDeleteDraft}
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full hover:bg-muted"
                  onClick={handleSend}
                  title="Send"
                >
                  <Send className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
            {/* Original message */}
            <p className="text-xs text-muted-foreground">{card.draft!.originalText}</p>
            {/* Draft reply */}
            <div className="mt-2 p-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-foreground">{card.draft!.draftText}</p>
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">{timeAgo}</span>
          </div>
        </div>
      </KanbanItem>
    );
  }

  return (
    <KanbanItem value={card.id} asHandle className="w-80">
      <div
        className="group flex gap-3 p-3 cursor-pointer rounded-2xl bg-card hover:shadow-md transition-all overflow-hidden"
        onClick={onClick}
      >
        <div className="relative shrink-0 self-start">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarSrc} alt={card.title} className="object-cover" />
            <AvatarFallback className="text-xs">
              {card.isGroup ? <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> : initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
            <PlatformIcon platform={card.platform} className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between h-5">
            <span className="truncate text-xs font-medium">{card.title}</span>
            <div className="flex items-center gap-1 h-5">
              {/* Action buttons - visible on hover */}
              {card.type === 'message' && (
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onPointerDownCapture={stopAllPropagation}
                  onMouseDownCapture={stopAllPropagation}
                  onTouchStartCapture={stopAllPropagation}
                >
                  {onArchive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full hover:bg-muted"
                      onClick={handleArchive}
                      title="Archive"
                    >
                      <Archive className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </Button>
                  )}
                  {onUnarchive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full hover:bg-muted"
                      onClick={handleUnarchive}
                      title="Unarchive"
                    >
                      <ArchiveRestore className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </Button>
                  )}
                  {onHide && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full hover:bg-muted"
                      onClick={handleHide}
                      title="Hide sender"
                    >
                      <EyeOff className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              )}
              {autopilotConfig && autopilotConfig.enabled && (
                <AutopilotStatusBadge
                  status={autopilotConfig.status}
                  mode={autopilotConfig.mode}
                  agentName={autopilotAgent?.name}
                  timeRemaining={getTimeRemaining()}
                />
              )}
              {unreadCount >= 1 && (
                <span className="ml-1 shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-1">
            {card.mediaTypes && card.mediaTypes.length > 0 && (
              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                {card.mediaTypes.slice(0, 2).map((type, i) => (
                  <MediaIcon key={i} type={type} className="h-4 w-4 text-muted-foreground" />
                ))}
              </div>
            )}
            <p className="line-clamp-2 text-xs text-muted-foreground">{card.preview}</p>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
    </KanbanItem>
  );
}

// Memoize the component to prevent re-renders when props haven't changed
export const MessageCard = memo(MessageCardComponent, (prevProps, nextProps) => {
  // Only re-render if card data actually changed
  const prevMedia = prevProps.card.mediaTypes?.join(',') || '';
  const nextMedia = nextProps.card.mediaTypes?.join(',') || '';
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.timestamp === nextProps.card.timestamp &&
    prevProps.card.preview === nextProps.card.preview &&
    prevProps.card.title === nextProps.card.title &&
    prevProps.card.unreadCount === nextProps.card.unreadCount &&
    prevMedia === nextMedia
  );
});
