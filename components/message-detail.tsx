'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { KanbanCard } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { MessageSquare } from 'lucide-react';

interface MessageDetailProps {
  card: KanbanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: (card: KanbanCard) => void;
}

export function MessageDetail({ card, open, onOpenChange, onReply }: MessageDetailProps) {
  if (!card) return null;

  const platformData = getPlatformInfo(card.platform);
  const isMessage = card.type === 'message';
  const isDraft = card.type === 'draft';

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={card.avatarUrl} alt={card.title} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {card.title}
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: `${platformData.color}20`,
                    color: platformData.color,
                  }}
                >
                  {platformData.name}
                </Badge>
              </SheetTitle>
              <SheetDescription>{timeAgo}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-4">
          {isDraft && card.draft && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Original message:</p>
              <p className="text-xs">{card.draft.originalText}</p>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <p className="whitespace-pre-wrap text-xs">
              {isDraft ? card.draft?.draftText || '(Empty draft)' : card.preview}
            </p>
          </div>

          {isMessage && card.message && !card.message.isFromMe && (
            <Button className="w-full" onClick={() => onReply(card)}>
              <MessageSquare className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Reply
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
