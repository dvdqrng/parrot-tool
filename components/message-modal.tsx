'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanCard } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { useChatHistory } from '@/hooks/use-chat-history';
import { Loader2, ChevronUp, Users } from 'lucide-react';
import { MessageBottomSection } from '@/components/message-bottom-section';

interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard | null;
  onSend?: (text: string) => Promise<void>;
  onSaveDraft?: (text: string) => void;
  onClearDraft?: () => void;
}

// Convert file:// URLs to proxied API URLs
function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function MessageModal({
  open,
  onOpenChange,
  card,
  onSend,
  onSaveDraft,
  onClearDraft,
}: MessageModalProps) {
  const [draftText, setDraftText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const lastSavedDraftRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const message = card?.message;
  const chatId = message?.chatId || null;
  const platform = message?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);

  const history = useChatHistory(open ? chatId : null, {
    initialLimit: 2,
    pollInterval: 0, // No polling in modal
  });

  // Reset draft when modal opens
  useEffect(() => {
    if (open && chatId) {
      setDraftText('');
      lastSavedDraftRef.current = '';
    }
  }, [open, chatId]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!draftText.trim() || !onSend) return;

    setIsSending(true);
    try {
      await onSend(draftText);
      setDraftText('');
      // Refresh history after sending to pick up the new message
      setTimeout(() => history.refresh(), 500);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsSending(false);
    }
  }, [draftText, onSend, history]);

  // Auto-save draft with debounce (clear immediately when empty)
  useEffect(() => {
    if (!chatId) return;

    const trimmedDraft = draftText.trim();

    // Only save/clear if the value actually changed
    if (trimmedDraft === lastSavedDraftRef.current) return;

    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Clear draft immediately when empty (for instant UI feedback)
    if (!trimmedDraft) {
      lastSavedDraftRef.current = trimmedDraft;
      onClearDraft?.();
      return;
    }

    // Debounce saves (500ms) to avoid lag while typing
    saveTimeoutRef.current = setTimeout(() => {
      lastSavedDraftRef.current = trimmedDraft;
      onSaveDraft?.(draftText);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draftText, chatId, onSaveDraft, onClearDraft]);

  if (!card || card.type !== 'message' || !message) {
    return null;
  }

  const title = card.title;
  const initials = title
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={getAvatarSrc(card.avatarUrl)} alt={title} className="object-cover" />
              <AvatarFallback className="text-xs">
                {card.isGroup ? <Users className="h-4 w-4" strokeWidth={2} /> : initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span>{title}</span>
              <Badge
                variant="secondary"
                className="text-xs w-fit"
                style={{
                  backgroundColor: `${platformData.color}20`,
                  color: platformData.color,
                }}
              >
                {platformData.name}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription>
            View conversation and send a reply
          </DialogDescription>
        </DialogHeader>

        {/* Chat history */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-[250px] pr-4">
            <div className="space-y-3">
              {/* Load more button */}
              {history.hasMore && !history.isLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={history.loadMore}
                  disabled={history.isLoadingMore}
                >
                  {history.isLoadingMore ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
                  ) : (
                    <ChevronUp className="h-4 w-4 mr-2" strokeWidth={2} />
                  )}
                  Load older messages
                </Button>
              )}

              {history.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={2} />
                </div>
              ) : history.messages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No messages found
                </div>
              ) : (
                history.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.isFromMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {!msg.isFromMe && card.isGroup && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-2">
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        <MessageBottomSection
          chatId={chatId}
          chatName={title}
          draftText={draftText}
          onDraftTextChange={setDraftText}
          isSending={isSending}
          sendSuccess={false}
          onSend={handleSend}
        />
      </DialogContent>
    </Dialog>
  );
}
