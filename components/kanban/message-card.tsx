'use client';

import { formatDistanceToNow } from 'date-fns';
import { Users, Archive, ArchiveRestore, EyeOff, Send, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { KanbanItem } from '@/components/ui/kanban';
import { KanbanCard } from '@/lib/types';
import { PlatformIcon } from '@/components/platform-icon';

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

export function MessageCard({ card, onClick, onArchive, onUnarchive, onHide, onSend, onDeleteDraft }: MessageCardProps) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(card.timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  })();

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
                {card.isGroup ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : initials}
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
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full hover:bg-muted"
                  onClick={handleSend}
                  title="Send"
                >
                  <Send className="h-3 w-3 text-muted-foreground" />
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
              {card.isGroup ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : initials}
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
                      <Archive className="h-3 w-3 text-muted-foreground" />
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
                      <ArchiveRestore className="h-3 w-3 text-muted-foreground" />
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
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
              {unreadCount >= 1 && (
                <span className="ml-1 shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{card.preview}</p>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
    </KanbanItem>
  );
}
