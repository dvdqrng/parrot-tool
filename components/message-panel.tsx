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
  getPendingActionsForChat,
} from '@/lib/storage';
import { getAIHeaders, getEffectiveAiProvider } from '@/lib/api-headers';
import { logger } from '@/lib/logger';
import { Loader2, ChevronUp, Users, X, MessagesSquare, RefreshCw, User } from 'lucide-react';
import { MessageBottomSection } from '@/components/message-bottom-section';
import { MediaAttachments } from '@/components/message-panel/media-attachments';
import { TextWithLinks } from '@/components/message-panel/text-with-links';
import { getAvatarSrc } from '@/components/message-panel/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useChatAutopilot } from '@/hooks/use-chat-autopilot';
import { useAutopilot } from '@/contexts/autopilot-context';
interface MessagePanelProps {
  card: KanbanCard | null;
  onClose: () => void;
  onSend?: (text: string) => Promise<void>;
  onSaveDraft?: (text: string) => void;
  isAiChatOpen?: boolean;
  onToggleAiChat?: () => void;
  isContactProfileOpen?: boolean;
  onToggleContactProfile?: () => void;
  draftTextFromAi?: string;
  onDraftTextFromAiConsumed?: () => void;
  onMessageContextChange?: (context: string, senderName: string) => void;
  onMessagesLoaded?: (chatId: string, messages: Array<{ timestamp: string; isFromMe: boolean }>) => void;
  aiEnabled?: boolean;
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
  isContactProfileOpen,
  onToggleContactProfile,
  draftTextFromAi,
  onDraftTextFromAiConsumed,
  onMessageContextChange,
  onMessagesLoaded,
  aiEnabled = true,
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

  // Get autopilot context to listen for config changes
  const { configVersion } = useAutopilot();

  // Check if autopilot is active for this chat
  const { config: autopilotConfig } = useChatAutopilot(chatId || null, { configVersion });
  const isAutopilotActive = autopilotConfig?.enabled;
  const autopilotStatus = autopilotConfig?.status;

  // Check if there are pending scheduled actions (indicates waiting state)
  const [hasPendingActions, setHasPendingActions] = useState(false);

  useEffect(() => {
    if (!chatId) {
      setHasPendingActions(false);
      return;
    }

    const checkPendingActions = () => {
      const pendingActions = getPendingActionsForChat(chatId);
      const hasPending = pendingActions.length > 0;
      logger.debug('[MessagePanel] Checking pending actions:', {
        chatId,
        pendingActionsCount: pendingActions.length,
        actions: pendingActions,
      });
      // Only update state if value changed to avoid re-renders
      setHasPendingActions(prev => prev === hasPending ? prev : hasPending);
    };

    checkPendingActions();

    // Check periodically for updates
    const interval = setInterval(checkPendingActions, 1000);
    return () => clearInterval(interval);
  }, [chatId]);

  // Map status to glow class
  const getAutopilotGlowClass = () => {
    if (!isAutopilotActive || !autopilotStatus) return null;

    // If status is active but has pending scheduled actions, show waiting state
    if (autopilotStatus === 'active' && hasPendingActions) {
      return 'autopilot-glow-waiting';
    }

    switch (autopilotStatus) {
      case 'active':
        return 'autopilot-glow-active';
      case 'paused':
        return 'autopilot-glow-paused';
      case 'error':
        return 'autopilot-glow-error';
      case 'goal-completed':
        return 'autopilot-glow-completed';
      case 'inactive':
        return null;
      default:
        return 'autopilot-glow-active';
    }
  };

  // Debug logging
  useEffect(() => {
    if (chatId) {
      logger.debug('[MessagePanel] Autopilot glow state:', {
        chatId,
        isAutopilotActive,
        status: autopilotStatus,
        hasPendingActions,
        glowClass: getAutopilotGlowClass(),
      });
    }
  }, [chatId, autopilotConfig, isAutopilotActive, autopilotStatus, hasPendingActions]);

  // Fetch chat history using limit-based fetching, merging with existing messages
  const fetchHistory = useCallback(async (limit: number, isLoadMore = false) => {
    if (!chatId) return;

    logger.debug(`[FetchHistory] Starting fetch: limit=${limit}, isLoadMore=${isLoadMore}, chatId=${chatId}`);

    // Only show loading indicator for initial load or explicit load more
    // Don't show loading for background polling to avoid UI flicker
    if (isLoadMore) {
      setIsLoadingMore(true);
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
      logger.debug(`[FetchHistory] Got ${result.data?.length || 0} messages from API`);

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
        // Only update state if there are actually new messages to avoid unnecessary re-renders
        setChatHistory(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));

          // If no new messages, return the same array reference to prevent re-render
          if (uniqueNewMessages.length === 0) {
            logger.debug(`[FetchHistory] No new messages, skipping update`);
            return prev;
          }

          logger.debug(`[FetchHistory] Adding ${uniqueNewMessages.length} new unique messages (had ${prev.length})`);
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

        // Notify parent about loaded messages for CRM stats tracking
        if (onMessagesLoaded && newMessages.length > 0) {
          onMessagesLoaded(chatId, newMessages.map(m => ({
            timestamp: m.timestamp,
            isFromMe: m.isFromMe,
          })));
        }
      }
    } catch (error) {
      logger.error('Failed to fetch chat history:', error instanceof Error ? error : String(error));
      toast.error('Failed to load chat history');
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      }
    }
  }, [chatId, message?.senderName, draft?.recipientName, onMessagesLoaded]);

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
      // Start with 20 messages - show loading only for initial load
      setIsLoadingHistory(true);
      fetchHistory(20).then(() => {
        setIsLoadingHistory(false);
        setInitialLoadDone(true);
        // Ensure scroll to bottom after initial load completes
        requestAnimationFrame(() => {
          const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        });
      }).catch(() => {
        setIsLoadingHistory(false);
      });
    }
  }, [isOpen, chatId, draft?.draftText, draft?.updatedAt, message?.id, fetchHistory]);

  // Auto-scroll to bottom when chat history changes
  useEffect(() => {
    if (scrollRef.current && chatHistory.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      });
    }
  }, [chatHistory]);

  // Poll for new messages when panel is open
  useEffect(() => {
    if (!isOpen || !chatId || !initialLoadDone) return;

    const pollInterval = setInterval(() => {
      // Fetch with the current limit we've loaded
      const currentLimit = loadedLimitRef.current[chatId] || 20;
      logger.debug(`[MessagePanel] Polling for new messages (limit: ${currentLimit})`);
      fetchHistory(currentLimit, false);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isOpen, chatId, initialLoadDone, fetchHistory]);

  // Track how many messages we've loaded for this chat
  const loadedLimitRef = useRef<Record<string, number>>({});

  // Load more messages (increase limit)
  const handleLoadMore = useCallback(() => {
    if (!chatId) {
      logger.debug('[LoadMore] No chatId, returning');
      return;
    }
    const currentLimit = loadedLimitRef.current[chatId] || 20;
    const newLimit = currentLimit + 20; // Add 20 more messages each time
    loadedLimitRef.current[chatId] = newLimit;
    logger.debug(`[LoadMore] Fetching ${newLimit} messages for chat ${chatId}`);
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
      logger.error('Failed to refresh context:', error instanceof Error ? error : String(error));
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
      if (settings.anthropicApiKey && settings.aiProvider === 'anthropic') {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      } else if (settings.openaiApiKey && settings.aiProvider === 'openai') {
        headers['x-openai-key'] = settings.openaiApiKey;
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
          provider: getEffectiveAiProvider(settings),
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
      logger.error('Failed to generate suggestion:', error instanceof Error ? error : String(error));
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
        'h-full transition-all duration-300 ease-in-out',
        isOpen ? 'w-96' : 'w-0'
      )}
    >
      <div className={cn(
        'h-full bg-card rounded-2xl flex flex-col overflow-hidden shadow-lg dark:border',
        getAutopilotGlowClass()
      )}>
      {isOpen && card && (message || draft) && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={getAvatarSrc(card.avatarUrl)} alt={title} className="object-cover" />
                <AvatarFallback className="text-xs">
                  {card.isGroup ? <Users className="h-4 w-4" strokeWidth={2} /> : initials}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshContext}
                disabled={isRefreshingContext}
                title="Refresh AI context"
              >
                {isRefreshingContext ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <RefreshCw className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
              {onToggleContactProfile && (
                <Button
                  variant={isContactProfileOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleContactProfile}
                  title="Contact Profile"
                >
                  <User className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
              {onToggleAiChat && (
                <Button
                  variant={isAiChatOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleAiChat}
                  title="AI Chat"
                >
                  <MessagesSquare className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={2} />
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
                  ) : (
                    <ChevronUp className="h-4 w-4 mr-2" strokeWidth={2} />
                  )}
                  Load older messages
                </Button>
              )}

              {isLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={2} />
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
                          <p className="text-xs whitespace-pre-wrap break-words overflow-hidden">
                            <TextWithLinks text={msg.text} />
                          </p>
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

          {/* Bottom section */}
          <div className="shrink-0 p-4">
            <MessageBottomSection
              chatId={chatId || null}
              chatName={title}
              latestMessage={message}
              draftText={draftText}
              onDraftTextChange={setDraftText}
              isGenerating={isGenerating}
              onGenerateAI={generateAISuggestion}
              isSending={isSending}
              sendSuccess={sendSuccess}
              onSend={handleSend}
              onSaveDraft={handleSaveDraft}
              aiEnabled={aiEnabled}
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
}
