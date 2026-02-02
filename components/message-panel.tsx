'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChatHistory } from '@/hooks/use-chat-history';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanCard, BeeperAttachment } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import {
  getThreadContext,
  formatThreadContextForPrompt,
  getPendingActionsForChat,
} from '@/lib/storage';
import { useAiPipeline } from '@/hooks/use-ai-pipeline';
import { logger } from '@/lib/logger';
import { Loader2, ChevronUp, Users, X, MessagesSquare, User } from 'lucide-react';
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
  onSaveAttachmentToMemory?: (attachment: BeeperAttachment) => void;
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
  onSaveAttachmentToMemory,
}: MessagePanelProps) {
  const [draftText, setDraftText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOpen = card !== null;
  const message = card?.message;
  const draft = card?.draft;
  const chatId = message?.chatId || draft?.chatId;
  const platform = message?.platform || draft?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);

  const { generateDraft } = useAiPipeline();

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

    // Observer and suggest modes: no glow, just a passive indicator
    if (autopilotConfig?.mode === 'observer' || autopilotConfig?.mode === 'suggest') return null;

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

  // Unified chat history: handles initial load, polling, load-more, and auto-load
  const history = useChatHistory(chatId, {
    autoLoadAll: !!isAutopilotActive,
    initialLimit: 20,
    pollInterval: isOpen ? 5000 : 0,
    senderName: message?.senderName || draft?.recipientName || 'Unknown',
    onMessagesLoaded,
  });

  // Initialize draft text when panel opens
  useEffect(() => {
    if (isOpen && chatId) {
      setDraftText(draft?.draftText || '');
    }
  }, [isOpen, chatId, draft?.draftText, draft?.updatedAt, message?.id]);

  // Auto-scroll to bottom when messages change, but NOT during batch auto-loading
  useEffect(() => {
    if (history.isAutoLoading) return;
    if (scrollRef.current && history.messages.length > 0) {
      requestAnimationFrame(() => {
        const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      });
    }
  }, [history.messages, history.isAutoLoading]);

  // Generate AI suggestion
  const generateAISuggestion = useCallback(async () => {
    if (!message && !draft || !chatId) return;

    setIsGenerating(true);
    try {
      const senderName = message?.senderName || draft?.recipientName || 'Unknown';
      const originalText = message?.text || draft?.originalText || '';

      const result = await generateDraft(chatId, originalText, senderName);
      if (result.text) {
        setDraftText(result.text);
      }
    } catch (error) {
      logger.error('Failed to generate suggestion:', error instanceof Error ? error : String(error));
      toast.error('Failed to generate AI suggestion');
    } finally {
      setIsGenerating(false);
    }
  }, [message, draft, chatId, generateDraft]);

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
      // Refresh history after sending to pick up the new message
      setTimeout(() => history.refresh(), 500);
    } catch (error) {
      // Error handling is done in parent
      setSendSuccess(false);
    } finally {
      setIsSending(false);
    }
  }, [draftText, onSend, chatId, history]);

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
  }, [history.messages, chatId, message, draft, onMessageContextChange]);

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
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No messages found
                </div>
              ) : (
                history.messages.map((msg) => {
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
                            <MediaAttachments attachments={msg.attachments!} isFromMe={msg.isFromMe} onSaveToMemory={onSaveAttachmentToMemory} />
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
