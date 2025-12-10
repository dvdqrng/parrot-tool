'use client';

import { formatDistanceToNow } from 'date-fns';
import { Users, Archive, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { KanbanItem } from '@/components/ui/kanban';
import { KanbanCard } from '@/lib/types';
import { PlatformIcon } from '@/components/platform-icon';

interface MessageCardProps {
  card: KanbanCard;
  onClick?: () => void;
  onArchive?: (card: KanbanCard) => void;
  onHide?: (card: KanbanCard) => void;
}

// Convert file:// URLs to proxied API URLs
function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function MessageCard({ card, onClick, onArchive, onHide }: MessageCardProps) {
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

  const handleHide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onHide?.(card);
  };

  const stopAllPropagation = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  return (
    <KanbanItem value={card.id} asHandle className="w-full">
      <div
        className="group flex gap-3 p-3 cursor-pointer rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden"
        onClick={onClick}
      >
        <div className="relative shrink-0 self-start">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarSrc} alt={card.title} className="object-cover" />
            <AvatarFallback className="text-xs">
              {card.isGroup ? <Users className="h-5 w-5" /> : initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
            <PlatformIcon platform={card.platform} className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between h-5">
            <span className="truncate font-medium text-sm">{card.title}</span>
            <div className="flex items-center gap-1 h-5">
              {/* Action buttons - visible on hover */}
              {card.type === 'message' && (
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
                    onClick={handleArchive}
                    title="Archive"
                  >
                    <Archive className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full hover:bg-muted"
                    onClick={handleHide}
                    title="Hide sender"
                  >
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              )}
              {unreadCount >= 1 && (
                <span className="ml-1 shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{card.preview}</p>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>
    </KanbanItem>
  );
}
