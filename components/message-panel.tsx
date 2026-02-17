'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChatHistory } from '@/hooks/use-chat-history';
import { useCompanion } from '@/hooks/use-companion';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { KanbanCard, CrmContactProfile, CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { Loader2, ChevronUp, Users, X, PanelRight } from 'lucide-react';
import { MessageBottomSection } from '@/components/message-bottom-section';
import { MediaAttachments } from '@/components/message-panel/media-attachments';
import { TextWithLinks } from '@/components/message-panel/text-with-links';
import { getAvatarSrc } from '@/components/message-panel/utils';
import { SidePanel, SidePanelTab } from '@/components/side-panel';
import { ContactProfileContent } from '@/components/contact-profile-content';
import { AiChatContent } from '@/components/intelligence/ai-chat-content';
import { cn } from '@/lib/utils';

interface MessagePanelProps {
  card: KanbanCard | null;
  onClose: () => void;
  onSend?: (text: string) => Promise<void>;
  onSaveDraft?: (text: string) => void;
  onClearDraft?: () => void;
  onMessagesLoaded?: (chatId: string, messages: Array<{ timestamp: string; isFromMe: boolean }>) => void;
  // Side panel control - allows parent to request opening the contact tab
  defaultSidePanelOpen?: boolean;
  // Contact profile props
  contact?: CrmContactProfile | null;
  allContacts?: Record<string, CrmContactProfile>;
  tags?: Record<string, CrmTag>;
  onSaveContact?: (contactId: string, updates: Partial<CrmContactProfile>) => void;
  onCreateTag?: (name: string) => CrmTag;
  onAddTag?: (contactId: string, tagId: string) => void;
  onRemoveTag?: (contactId: string, tagId: string) => void;
  onUnlinkPlatform?: (contactId: string, chatId: string) => void;
  onMerge?: (targetContactId: string, sourceContactId: string) => void;
  onLinkPlatform?: (contactId: string, chatId: string, platform: string, accountId: string, displayName: string, avatarUrl?: string) => void;
  onAddAttachments?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
}

export function MessagePanel({
  card,
  onClose,
  onSend,
  onSaveDraft,
  onClearDraft,
  onMessagesLoaded,
  // Side panel control
  defaultSidePanelOpen = false,
  // Contact profile props
  contact,
  allContacts = {},
  tags = {},
  onSaveContact,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  onUnlinkPlatform,
  onMerge,
  onLinkPlatform,
  onAddAttachments,
  onRemoveAttachment,
}: MessagePanelProps) {
  const [draftText, setDraftText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSavedDraftRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Side panel state - unified panel for Contact and AI Chat
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(defaultSidePanelOpen);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('contact');

  // Sync side panel open state with prop
  useEffect(() => {
    if (defaultSidePanelOpen) {
      setIsSidePanelOpen(true);
      setSidePanelTab('contact');
    }
  }, [defaultSidePanelOpen]);

  // Reset side panel when card changes (don't persist across conversations)
  useEffect(() => {
    if (!defaultSidePanelOpen) {
      setIsSidePanelOpen(false);
    }
  }, [card?.id, defaultSidePanelOpen]);

  const isOpen = card !== null;
  const message = card?.message;
  const draft = card?.draft;
  const chatId = message?.chatId || draft?.chatId;
  const platform = message?.platform || draft?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);

  // AI Companion state - need to declare before chat history
  // because autoLoadAll depends on whether AI is enabled
  const [aiEnabledForHistory, setAiEnabledForHistory] = useState(false);

  // Unified chat history: handles initial load, polling, load-more
  // When AI is enabled, autoLoadAll=true fetches full history in batches
  const history = useChatHistory(chatId, {
    autoLoadAll: aiEnabledForHistory,
    initialLimit: 20,
    pollInterval: isOpen ? 5000 : 0,
    onMessagesLoaded,
  });

  const title = card?.title || '';

  // AI Companion hook
  const companion = useCompanion({
    chatId: chatId || null,
    contactName: title,
    platform,
    recentMessages: history.messages.map((m) => ({
      id: m.id,
      text: m.text || '',
      isFromMe: m.isFromMe,
      timestamp: m.timestamp,
      senderName: m.senderName,
    })),
    draftText,
    onApplyDraft: setDraftText,
  });

  // Sync AI enabled state with history loader
  // When AI is enabled, trigger full history loading for extraction
  useEffect(() => {
    setAiEnabledForHistory(companion.isEnabled);
  }, [companion.isEnabled]);

  // Initialize draft text when panel opens
  useEffect(() => {
    if (isOpen && chatId) {
      const initialDraft = draft?.draftText || '';
      setDraftText(initialDraft);
      lastSavedDraftRef.current = initialDraft.trim();
    }
  }, [isOpen, chatId, draft?.draftText, draft?.updatedAt, message?.id]);

  // Auto-scroll to bottom when messages change
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

  const initials = title
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'h-full transition-all duration-300 ease-in-out flex gap-2',
        isOpen ? (isSidePanelOpen ? 'w-[776px]' : 'w-96') : 'w-0'
      )}
    >
      {/* Main Message Panel */}
      <div className="h-full w-96 bg-card rounded-2xl flex flex-col overflow-hidden shadow-lg dark:border shrink-0">
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
              {/* Side panel toggle - single button */}
              <Button
                variant={isSidePanelOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                title={isSidePanelOpen ? 'Close Panel' : 'Open Panel'}
              >
                <PanelRight className="h-4 w-4" strokeWidth={2} />
              </Button>
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
              draftText={draftText}
              onDraftTextChange={setDraftText}
              isSending={isSending}
              sendSuccess={sendSuccess}
              onSend={handleSend}
              // AI Companion - orb button inline with send
              isAiEnabled={companion.isEnabled}
              hasCompanionActivity={companion.hasActivity}
              onToggleEnabled={companion.toggleEnabled}
            />
          </div>
        </>
      )}
      </div>

      {/* Unified Side Panel - Contact Profile or AI Chat */}
      {isOpen && isSidePanelOpen && (
        <SidePanel
          isOpen={true}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
          onClose={() => setIsSidePanelOpen(false)}
          showAiTab={companion.isEnabled}
          contactContent={
            <ContactProfileContent
              contact={contact || null}
              allContacts={allContacts}
              tags={tags}
              onSave={onSaveContact || (() => {})}
              onCreateTag={onCreateTag || (() => ({ id: '', name: '', color: '', createdAt: new Date().toISOString() }))}
              onAddTag={onAddTag || (() => {})}
              onRemoveTag={onRemoveTag || (() => {})}
              onUnlinkPlatform={onUnlinkPlatform}
              onMerge={onMerge}
              onLinkPlatform={onLinkPlatform}
              onAddAttachments={onAddAttachments}
              onRemoveAttachment={onRemoveAttachment}
            />
          }
          aiChatContent={
            <AiChatContent
              messages={companion.messages}
              onSendMessage={companion.sendMessage}
              onApplyDraft={companion.applyDraft}
              onDismissInsight={companion.dismissInsight}
              isLoading={companion.isLoading}
              isThinking={companion.isThinking}
              chatId={chatId}
              error={companion.error}
              onClearError={companion.clearError}
            />
          }
        />
      )}
    </div>
  );
}
