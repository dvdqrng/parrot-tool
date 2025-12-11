'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
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
import { Loader2, Sparkles, Send, Save, ChevronUp, Users, X, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessagePanelProps {
  card: KanbanCard | null;
  onClose: () => void;
  onSend?: (text: string) => Promise<void>;
  onSaveDraft?: (text: string) => void;
  isAiChatOpen?: boolean;
  onToggleAiChat?: () => void;
  draftTextFromAi?: string;
  onDraftTextFromAiConsumed?: () => void;
  onMessageContextChange?: (context: string, senderName: string) => void;
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

export function MessagePanel({
  card,
  onClose,
  onSend,
  onSaveDraft,
  isAiChatOpen,
  onToggleAiChat,
  draftTextFromAi,
  onDraftTextFromAiConsumed,
  onMessageContextChange,
}: MessagePanelProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(2);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);

  const isOpen = card !== null;
  const message = card?.message;
  const draft = card?.draft;
  const chatId = message?.chatId || draft?.chatId;
  const platform = message?.platform || draft?.platform || 'unknown';
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
        const senderName = message?.senderName || draft?.recipientName || 'Unknown';
        const contextMessages: ThreadContextMessage[] = sortedMessages.map(m => ({
          id: m.id,
          text: m.text,
          isFromMe: m.isFromMe,
          senderName: m.senderName,
          timestamp: m.timestamp,
        }));
        updateThreadContextWithNewMessages(chatId, senderName, contextMessages);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMore(false);
    }
  }, [chatId]);

  // Load initial history when panel opens with a new card
  useEffect(() => {
    if (isOpen && chatId) {
      setHistoryLimit(2);
      // Initialize draft text from existing draft, or clear it
      setDraftText(draft?.draftText || '');
      fetchHistory(2);
    }
  }, [isOpen, chatId, draft?.draftText, fetchHistory]);

  // Load more messages
  const handleLoadMore = useCallback(() => {
    const newLimit = historyLimit + 10;
    setHistoryLimit(newLimit);
    fetchHistory(newLimit);
  }, [historyLimit, fetchHistory]);

  // Manually refresh thread context with more messages
  const handleRefreshContext = useCallback(async () => {
    if (!chatId) return;

    setIsRefreshingContext(true);
    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      // Fetch more messages (50) to build comprehensive context
      const response = await fetch(
        `/api/beeper/chats?chatId=${encodeURIComponent(chatId)}&limit=50`,
        { headers }
      );
      const result = await response.json();

      if (result.data) {
        const senderName = message?.senderName || draft?.recipientName || 'Unknown';
        const contextMessages: ThreadContextMessage[] = result.data.map((m: BeeperMessage) => ({
          id: m.id,
          text: m.text,
          isFromMe: m.isFromMe,
          senderName: m.senderName,
          timestamp: m.timestamp,
        }));
        updateThreadContextWithNewMessages(chatId, senderName, contextMessages);
        toast.success('Thread context updated with latest messages');
      }
    } catch (error) {
      console.error('Failed to refresh context:', error);
      toast.error('Failed to refresh thread context');
    } finally {
      setIsRefreshingContext(false);
    }
  }, [chatId, message, draft]);

  // Generate AI suggestion
  const generateAISuggestion = useCallback(async () => {
    if (!message && !draft || !chatId) return;

    setIsGenerating(true);
    try {
      const settings = loadSettings();
      const toneSettings = loadToneSettings();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey) {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      }

      const senderName = message?.senderName || draft?.recipientName || 'Unknown';
      const originalText = message?.text || draft?.originalText || '';

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
          originalMessage: originalText,
          senderName,
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
  }, [message, draft, chatId]);

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
    onClose();
  }, [draftText, onSaveDraft, onClose]);

  // Apply draft text from AI when provided
  useEffect(() => {
    if (draftTextFromAi) {
      setDraftText(draftTextFromAi);
      onDraftTextFromAiConsumed?.();
    }
  }, [draftTextFromAi, onDraftTextFromAiConsumed]);

  // Notify parent about message context changes for AI chat
  useEffect(() => {
    if (onMessageContextChange && chatId && (message || draft)) {
      // Use persistent thread context instead of just current chatHistory
      const threadContext = getThreadContext(chatId);
      const context = formatThreadContextForPrompt(threadContext);
      const senderName = message?.senderName || draft?.recipientName || 'Unknown';
      if (context) {
        onMessageContextChange(context, senderName);
      }
    }
  }, [chatHistory, chatId, message, draft, onMessageContextChange]);

  const title = card?.title || '';
  const initials = title
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'h-full bg-white rounded-2xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
        isOpen ? 'w-96' : 'w-0'
      )}
    >
      {isOpen && card && (message || draft) && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={getAvatarSrc(card.avatarUrl)} alt={title} className="object-cover" />
                <AvatarFallback className="text-xs">
                  {card.isGroup ? <Users className="h-5 w-5" /> : initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{title}</span>
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
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshContext}
                disabled={isRefreshingContext}
                title="Refresh AI context"
              >
                {isRefreshingContext ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {onToggleAiChat && (
                <Button
                  variant={isAiChatOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleAiChat}
                  title="AI Chat"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat history */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-3">
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
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
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

          <Separator className="shrink-0" />

          {/* Draft area */}
          <div className="shrink-0 p-4 space-y-3">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSaveDraft}
                disabled={!draftText.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                className="flex-1"
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
