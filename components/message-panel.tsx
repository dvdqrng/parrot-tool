'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanCard, BeeperMessage, BeeperAttachment } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import {
  loadSettings,
  loadToneSettings,
  loadWritingStylePatterns,
  updateThreadContextWithNewMessages,
  getThreadContext,
  formatThreadContextForPrompt,
  getAiChatForThread,
  formatAiChatSummaryForPrompt,
  ThreadContextMessage,
} from '@/lib/storage';
import { Loader2, Sparkles, Send, Save, ChevronUp, Users, X, MessagesSquare, RefreshCw, Check, Image, Video, Music, Mic, FileText } from 'lucide-react';
import { ChatAutopilotConfig } from '@/components/autopilot/chat-autopilot-config';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Helper to render text with clickable links
function renderTextWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex since we're reusing it
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}


// Convert file:// URLs to proxied API URLs for media
function getMediaSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/media?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Render media attachments
function MediaAttachments({ attachments, isFromMe }: { attachments: BeeperAttachment[]; isFromMe: boolean }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att, index) => {
        const mediaSrc = getMediaSrc(att.srcURL);
        const posterSrc = getMediaSrc(att.posterImg);

        // Image (including GIF and sticker)
        if (att.type === 'img' || att.isGif || att.isSticker) {
          return (
            <div key={index} className="relative">
              {mediaSrc ? (
                <img
                  src={mediaSrc}
                  alt={att.fileName || 'Image'}
                  className={cn(
                    "max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity",
                    att.isSticker && "bg-transparent max-h-32",
                    !att.isSticker && "max-h-64"
                  )}
                  style={att.size ? {
                    maxWidth: Math.min(att.size.width || 256, 256),
                    aspectRatio: att.size.width && att.size.height
                      ? `${att.size.width} / ${att.size.height}`
                      : undefined
                  } : undefined}
                  onClick={() => mediaSrc && window.open(mediaSrc, '_blank')}
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Image className="h-4 w-4" strokeWidth={1.5} />
                  <span>{att.isGif ? 'GIF' : att.isSticker ? 'Sticker' : 'Photo'}</span>
                </div>
              )}
            </div>
          );
        }

        // Video
        if (att.type === 'video') {
          return (
            <div key={index} className="relative">
              {mediaSrc ? (
                <video
                  src={mediaSrc}
                  poster={posterSrc}
                  controls
                  className="max-w-full max-h-64 rounded-lg"
                  style={att.size ? {
                    maxWidth: Math.min(att.size.width || 256, 256),
                  } : undefined}
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Video className="h-4 w-4" strokeWidth={1.5} />
                  <span>Video{att.duration ? ` (${Math.floor(att.duration / 60)}:${(att.duration % 60).toString().padStart(2, '0')})` : ''}</span>
                </div>
              )}
            </div>
          );
        }

        // Audio / Voice note
        if (att.type === 'audio' || att.isVoiceNote) {
          return (
            <div key={index} className="w-full">
              {mediaSrc ? (
                <audio
                  src={mediaSrc}
                  controls
                  className="w-full max-w-[200px] h-8"
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  {att.isVoiceNote ? <Mic className="h-4 w-4" strokeWidth={1.5} /> : <Music className="h-4 w-4" strokeWidth={1.5} />}
                  <span>{att.isVoiceNote ? 'Voice message' : 'Audio'}{att.duration ? ` (${Math.floor(att.duration / 60)}:${(att.duration % 60).toString().padStart(2, '0')})` : ''}</span>
                </div>
              )}
            </div>
          );
        }

        // File / Unknown
        if (att.type === 'unknown' && att.fileName) {
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 text-xs p-2 rounded-lg cursor-pointer hover:opacity-80",
                isFromMe ? "bg-primary-foreground/10" : "bg-background/50"
              )}
              onClick={() => mediaSrc && window.open(mediaSrc, '_blank')}
            >
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{att.fileName}</span>
              {att.fileSize && (
                <span className="text-xs opacity-60 shrink-0">
                  ({(att.fileSize / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

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
  attachments?: BeeperAttachment[];
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
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const isOpen = card !== null;
  const message = card?.message;
  const draft = card?.draft;
  const chatId = message?.chatId || draft?.chatId;
  const platform = message?.platform || draft?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);

  // Fetch chat history using limit-based fetching, merging with existing messages
  const fetchHistory = useCallback(async (limit: number, isLoadMore = false) => {
    if (!chatId) return;

    console.log(`[FetchHistory] Starting fetch: limit=${limit}, isLoadMore=${isLoadMore}, chatId=${chatId}`);

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

      // Use limit parameter to fetch N most recent messages
      const response = await fetch(
        `/api/beeper/chats?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
        { headers }
      );
      const result = await response.json();
      console.log(`[FetchHistory] Got ${result.data?.length || 0} messages from API`);

      if (result.data) {
        const newMessages: ChatMessage[] = result.data.map((m: BeeperMessage) => ({
          id: m.id,
          text: m.text,
          timestamp: m.timestamp,
          isFromMe: m.isFromMe,
          senderName: m.senderName,
          senderAvatarUrl: m.senderAvatarUrl,
          attachments: m.attachments,
        }));

        // Merge with existing messages - keep all unique messages by ID
        setChatHistory(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
          console.log(`[FetchHistory] Adding ${uniqueNewMessages.length} new unique messages (had ${prev.length})`);
          const merged = [...prev, ...uniqueNewMessages];
          // Sort by timestamp (oldest first for chat display)
          return merged.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });

        // If we got fewer messages than requested, there's no more history
        setHasMoreHistory(newMessages.length >= limit);

        // Save to persistent thread context (for AI)
        const senderName = message?.senderName || draft?.recipientName || 'Unknown';
        const contextMessages: ThreadContextMessage[] = newMessages.map(m => ({
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
  }, [chatId, message?.senderName, draft?.recipientName]);

  // Load initial history when panel opens with a new card
  useEffect(() => {
    if (isOpen && chatId) {
      // Initialize draft text from existing draft, or clear it
      setDraftText(draft?.draftText || '');
      setInitialLoadDone(false);

      // First, load persisted messages from ThreadContext (instant display)
      const threadContext = getThreadContext(chatId);
      if (threadContext && threadContext.messages.length > 0) {
        // Convert ThreadContextMessage to ChatMessage for display
        const persistedMessages: ChatMessage[] = threadContext.messages.map(m => ({
          id: m.id,
          text: m.text,
          timestamp: m.timestamp,
          isFromMe: m.isFromMe,
          senderName: m.senderName,
          senderAvatarUrl: undefined, // ThreadContext doesn't store avatars
          attachments: undefined, // ThreadContext doesn't store attachments
        }));
        setChatHistory(persistedMessages);
        setHasMoreHistory(true); // Assume there's more history available
      } else {
        setChatHistory([]);
      }

      // Then fetch recent messages from API to get any new ones (and full message data with attachments)
      // Start with 20 messages
      fetchHistory(20).then(() => setInitialLoadDone(true));
    }
  }, [isOpen, chatId, draft?.draftText, fetchHistory]);

  // Auto-scroll to bottom when chat history changes
  useEffect(() => {
    if (scrollRef.current && chatHistory.length > 0) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  // Track how many messages we've loaded for this chat
  const loadedLimitRef = useRef<Record<string, number>>({});

  // Load more messages (increase limit)
  const handleLoadMore = useCallback(() => {
    if (!chatId) {
      console.log('[LoadMore] No chatId, returning');
      return;
    }
    const currentLimit = loadedLimitRef.current[chatId] || 20;
    const newLimit = currentLimit + 20; // Add 20 more messages each time
    loadedLimitRef.current[chatId] = newLimit;
    console.log(`[LoadMore] Fetching ${newLimit} messages for chat ${chatId}`);
    fetchHistory(newLimit, true);
  }, [chatId, fetchHistory]);

  // Manually refresh thread context with more messages (last 24 hours)
  const handleRefreshContext = useCallback(async () => {
    if (!chatId) return;

    setIsRefreshingContext(true);
    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      // Fetch messages from last 24 hours to build comprehensive context
      const response = await fetch(
        `/api/beeper/chats?chatId=${encodeURIComponent(chatId)}&sinceHours=24`,
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
        toast.success(`Thread context updated with ${result.data.length} messages from last 24h`);
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
      const writingStyle = loadWritingStylePatterns();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey && settings.aiProvider !== 'ollama') {
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
          writingStyle: writingStyle.sampleMessages.length > 0 ? writingStyle : undefined,
          threadContext: threadContextStr,
          aiChatSummary,
          // Provider settings
          provider: settings.aiProvider || 'anthropic',
          ollamaModel: settings.ollamaModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
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
    if (!draftText.trim() || !onSend || !chatId) return;

    setIsSending(true);
    setSendSuccess(false);
    try {
      await onSend(draftText);
      setDraftText('');
      setSendSuccess(true);
      // Reset success state after 2 seconds
      setTimeout(() => setSendSuccess(false), 2000);
      // Refresh history after sending - use the limit we've loaded for this chat
      const limitToFetch = loadedLimitRef.current[chatId] || 20;
      setTimeout(() => fetchHistory(limitToFetch), 500);
    } catch (error) {
      // Error handling is done in parent
      setSendSuccess(false);
    } finally {
      setIsSending(false);
    }
  }, [draftText, onSend, chatId, fetchHistory]);

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
        'h-full bg-card rounded-2xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-lg',
        isOpen ? 'w-96 dark:border' : 'w-0'
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
                  {card.isGroup ? <Users className="h-4 w-4" strokeWidth={1.5} /> : initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{title}</span>
                <Badge
                  variant="secondary"
                  className="w-fit"
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
              {chatId && (
                <ChatAutopilotConfig chatId={chatId} chatName={title} latestMessage={message} />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshContext}
                disabled={isRefreshingContext}
                title="Refresh AI context"
              >
                {isRefreshingContext ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                )}
              </Button>
              {onToggleAiChat && (
                <Button
                  variant={isAiChatOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleAiChat}
                  title="AI Chat"
                >
                  <MessagesSquare className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          {/* Chat history */}
          <ScrollArea className="flex-1 min-h-0 w-full" ref={scrollRef}>
            <div className="p-4 space-y-3 overflow-hidden">
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <ChevronUp className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  )}
                  Load older messages
                </Button>
              )}

              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No messages found
                </div>
              ) : (
                chatHistory.map((msg) => {
                  const hasMedia = msg.attachments && msg.attachments.length > 0;
                  const hasText = msg.text && msg.text.trim().length > 0;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col w-full min-w-0 ${msg.isFromMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 overflow-hidden ${
                          msg.isFromMe
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {!msg.isFromMe && card.isGroup && (
                          <p className="text-xs font-medium mb-1 opacity-70 break-words">
                            {msg.senderName}
                          </p>
                        )}
                        {/* Media attachments */}
                        {hasMedia && (
                          <div className={hasText ? "mb-2" : ""}>
                            <MediaAttachments attachments={msg.attachments!} isFromMe={msg.isFromMe} />
                          </div>
                        )}
                        {/* Text content */}
                        {hasText && (
                          <p className="text-xs whitespace-pre-wrap break-words">{renderTextWithLinks(msg.text)}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 px-2">
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <Separator className="shrink-0" />

          {/* Draft area */}
          <div className="shrink-0 p-4 space-y-3">
            <Textarea
              placeholder="Type your reply..."
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="min-h-[80px] resize-none shadow-none"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={generateAISuggestion}
                disabled={isGenerating}
                title="AI Draft"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                )}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleSaveDraft}
                disabled={!draftText.trim()}
              >
                <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Save Draft
              </Button>
              <Button
                className={cn(
                  "flex-1 transition-colors",
                  sendSuccess && "bg-green-600 hover:bg-green-600"
                )}
                onClick={handleSend}
                disabled={!draftText.trim() || isSending || sendSuccess}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={1.5} />
                ) : sendSuccess ? (
                  <Check className="h-4 w-4 mr-2" strokeWidth={1.5} />
                ) : (
                  <Send className="h-4 w-4 mr-2" strokeWidth={1.5} />
                )}
                {isSending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
