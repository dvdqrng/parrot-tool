'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanCard, BeeperMessage } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import {
  loadSettings,
  loadToneSettings,
  updateThreadContextWithNewMessages,
  getThreadContext,
  formatThreadContextForPrompt,
  getAiChatForThread,
  formatAiChatSummaryForPrompt,
  ThreadContextMessage,
} from '@/lib/storage';
import { Loader2, Sparkles, Send, Save, ChevronUp, Users } from 'lucide-react';
import { toast } from 'sonner';

interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: KanbanCard | null;
  onSend?: (text: string) => Promise<void>;
  onSaveDraft?: (text: string) => void;
}

// Convert file:// URLs to proxied API URLs
function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
  senderName: string;
  senderAvatarUrl?: string;
}

export function MessageModal({
  open,
  onOpenChange,
  card,
  onSend,
  onSaveDraft,
}: MessageModalProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(2);

  const message = card?.message;
  const chatId = message?.chatId;
  const platform = message?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);

  // Fetch chat history
  const fetchHistory = useCallback(async (limit: number) => {
    if (!chatId) return;

    const isLoadMore = limit > 2;
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingHistory(true);
    }

    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch(
        `/api/beeper/chats?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
        { headers }
      );
      const result = await response.json();

      if (result.data) {
        const messages: ChatMessage[] = result.data.map((m: BeeperMessage) => ({
          id: m.id,
          text: m.text,
          timestamp: m.timestamp,
          isFromMe: m.isFromMe,
          senderName: m.senderName,
          senderAvatarUrl: m.senderAvatarUrl,
        }));
        // Reverse to show oldest first (for chat-style display)
        const sortedMessages = messages.reverse();
        setChatHistory(sortedMessages);
        setHasMoreHistory(messages.length >= limit);

        // Save to persistent thread context
        if (message) {
          const contextMessages: ThreadContextMessage[] = sortedMessages.map(m => ({
            id: m.id,
            text: m.text,
            isFromMe: m.isFromMe,
            senderName: m.senderName,
            timestamp: m.timestamp,
          }));
          updateThreadContextWithNewMessages(chatId, message.senderName, contextMessages);
        }
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMore(false);
    }
  }, [chatId, message]);

  // Load initial history when modal opens
  useEffect(() => {
    if (open && chatId) {
      setHistoryLimit(2);
      setDraftText('');
      fetchHistory(2);
    }
  }, [open, chatId, fetchHistory]);

  // Load more messages
  const handleLoadMore = useCallback(() => {
    const newLimit = historyLimit + 10;
    setHistoryLimit(newLimit);
    fetchHistory(newLimit);
  }, [historyLimit, fetchHistory]);

  // Generate AI suggestion
  const generateAISuggestion = useCallback(async () => {
    if (!message || !chatId) return;

    setIsGenerating(true);
    try {
      const settings = loadSettings();
      const toneSettings = loadToneSettings();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey) {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      }

      // Get persistent thread context
      const threadContext = getThreadContext(chatId);
      const threadContextStr = formatThreadContextForPrompt(threadContext);

      // Get AI chat history for this thread
      const aiChatHistory = getAiChatForThread(chatId);
      const aiChatSummary = formatAiChatSummaryForPrompt(aiChatHistory);

      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          originalMessage: message.text,
          senderName: message.senderName,
          toneSettings,
          threadContext: threadContextStr,
          aiChatSummary,
        }),
      });

      const result = await response.json();
      if (result.data?.suggestedReply) {
        setDraftText(result.data.suggestedReply);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      toast.error('Failed to generate AI suggestion');
    } finally {
      setIsGenerating(false);
    }
  }, [message, chatId]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!draftText.trim() || !onSend) return;

    setIsSending(true);
    try {
      await onSend(draftText);
      setDraftText('');
      // Refresh history after sending
      setTimeout(() => fetchHistory(historyLimit), 500);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsSending(false);
    }
  }, [draftText, onSend, fetchHistory, historyLimit]);

  // Save draft
  const handleSaveDraft = useCallback(() => {
    if (!draftText.trim() || !onSaveDraft) return;
    onSaveDraft(draftText);
    onOpenChange(false);
  }, [draftText, onSaveDraft, onOpenChange]);

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
                {card.isGroup ? <Users className="h-5 w-5" /> : initials}
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
              {hasMoreHistory && !isLoadingHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronUp className="mr-2 h-4 w-4" />
                  )}
                  Load older messages
                </Button>
              )}

              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No messages found
                </div>
              ) : (
                chatHistory.map((msg) => (
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

        {/* Draft area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Your reply:</label>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAISuggestion}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isGenerating ? 'Generating...' : 'AI Draft'}
            </Button>
          </div>
          <Textarea
            placeholder="Type your reply..."
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!draftText.trim()}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button
            onClick={handleSend}
            disabled={!draftText.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
