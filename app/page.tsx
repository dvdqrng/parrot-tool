'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Settings, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageBoard } from '@/components/kanban/message-board';
import { MessageDetail } from '@/components/message-detail';
import { DraftComposer } from '@/components/draft-composer';
import { MessagePanel } from '@/components/message-panel';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { useSettingsContext } from '@/contexts/settings-context';
import { useMessages } from '@/hooks/use-messages';
import { useDrafts } from '@/hooks/use-drafts';
import { useAiChatHistory } from '@/hooks/use-ai-chat-history';
import { KanbanCard, ColumnId, BeeperMessage, Draft } from '@/lib/types';
import { loadHiddenChats, addHiddenChat } from '@/lib/storage';
import { toast } from 'sonner';

export default function Home() {
  const { settings, isLoaded: settingsLoaded } = useSettingsContext();

  // Hidden chats state - load on mount
  const [hiddenChats, setHiddenChats] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return loadHiddenChats();
  });

  // Optimistically archived chats (for immediate UI feedback)
  const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set());

  const {
    unreadMessages,
    sentMessages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    avatars,
    chatInfo,
  } = useMessages(settings.selectedAccountIds, hiddenChats);
  const { drafts, createDraft, updateDraft, deleteDraft } = useDrafts();

  // Filter out optimistically archived chats for immediate UI feedback
  const filteredUnreadMessages = unreadMessages.filter(m => !archivedChats.has(m.chatId));

  // UI state
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'new' | 'edit'>('new');
  const [composerMessage, setComposerMessage] = useState<BeeperMessage | null>(null);
  const [composerDraft, setComposerDraft] = useState<Draft | null>(null);

  // AI Chat panel state
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [messageContext, setMessageContext] = useState('');
  const [senderName, setSenderName] = useState('');
  const [draftTextFromAi, setDraftTextFromAi] = useState<string | undefined>(undefined);

  // Get the current chat ID from selected card (for per-thread AI chat)
  const currentChatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId || null;
  const { messages: aiChatMessages, setMessages: setAiChatMessages } = useAiChatHistory(currentChatId);

  // Handle card click - open panel for both messages and drafts
  const handleCardClick = useCallback((card: KanbanCard) => {
    // Toggle selection - if clicking same card, deselect it
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }, []);

  // Handle reply from detail panel
  const handleReply = useCallback((card: KanbanCard) => {
    if (card.type === 'message' && card.message) {
      setComposerMessage(card.message);
      setComposerDraft(null);
      setComposerMode('new');
      setDetailOpen(false);
      setComposerOpen(true);
    } else if (card.type === 'draft' && card.draft) {
      setComposerMessage(null);
      setComposerDraft(card.draft);
      setComposerMode('edit');
      setDetailOpen(false);
      setComposerOpen(true);
    }
  }, []);

  // Handle dragging card to drafts column
  const handleMoveToColumn = useCallback((card: KanbanCard, fromColumn: ColumnId, toColumn: ColumnId) => {
    if (fromColumn === 'unread' && toColumn === 'drafts' && card.type === 'message' && card.message) {
      // Open the message panel (same as clicking the card)
      setSelectedCard(card);
    }
  }, []);

  // Handle archive chat
  const handleArchive = useCallback(async (card: KanbanCard) => {
    const chatId = card.message?.chatId;
    if (!chatId) return;

    // Optimistically remove from UI
    setArchivedChats(prev => new Set(prev).add(chatId));

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch(`/api/beeper/chats/${encodeURIComponent(chatId)}/archive`, {
        method: 'POST',
        headers,
      });

      const result = await response.json();

      if (result.error) {
        // Revert optimistic update on error
        setArchivedChats(prev => {
          const updated = new Set(prev);
          updated.delete(chatId);
          return updated;
        });
        toast.error(`Failed to archive: ${result.error}`);
        return;
      }

      toast.success('Chat archived');
    } catch {
      // Revert optimistic update on error
      setArchivedChats(prev => {
        const updated = new Set(prev);
        updated.delete(chatId);
        return updated;
      });
      toast.error('Failed to archive chat');
    }
  }, [settings.beeperAccessToken]);

  // Handle hide chat (local only)
  const handleHide = useCallback((card: KanbanCard) => {
    const chatId = card.message?.chatId;
    if (!chatId) return;

    const updated = addHiddenChat(
      chatId,
      card.title,
      card.avatarUrl,
      card.platform
    );
    setHiddenChats(new Set(updated));
    toast.success('Chat hidden. You can unhide chats in Settings.');
  }, []);

  // Handle save draft (from DraftComposer)
  const handleSaveDraft = useCallback((draftText: string) => {
    if (composerMode === 'new' && composerMessage) {
      // Get avatar from the avatars map or the message itself
      const avatarUrl = chatInfo?.[composerMessage.chatId]?.isGroup
        ? undefined
        : (avatars?.[composerMessage.chatId] || composerMessage.senderAvatarUrl);
      const isGroup = chatInfo?.[composerMessage.chatId]?.isGroup;
      createDraft(composerMessage, draftText, avatarUrl, isGroup);
      toast.success('Draft saved');
    } else if (composerMode === 'edit' && composerDraft) {
      updateDraft(composerDraft.id, { draftText });
      toast.success('Draft updated');
    }
  }, [composerMode, composerMessage, composerDraft, createDraft, updateDraft, avatars, chatInfo]);

  // Handle save draft from MessagePanel
  const handleSaveDraftFromPanel = useCallback((draftText: string) => {
    // If viewing a draft, update it
    if (selectedCard?.type === 'draft' && selectedCard.draft) {
      updateDraft(selectedCard.draft.id, { draftText });
      toast.success('Draft updated');
      return;
    }

    // If viewing a message, create a new draft
    const message = selectedCard?.message;
    if (!message) return;

    const avatarUrl = chatInfo?.[message.chatId]?.isGroup
      ? undefined
      : (avatars?.[message.chatId] || message.senderAvatarUrl);
    const isGroup = chatInfo?.[message.chatId]?.isGroup;
    createDraft(message, draftText, avatarUrl, isGroup);
    toast.success('Draft saved');
  }, [selectedCard, createDraft, updateDraft, avatars, chatInfo]);

  // Handle closing the message panel
  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
    setIsAiChatOpen(false);
  }, []);

  // Toggle AI chat panel
  const handleToggleAiChat = useCallback(() => {
    setIsAiChatOpen(prev => !prev);
  }, []);

  // Handle message context change from MessagePanel
  const handleMessageContextChange = useCallback((context: string, sender: string) => {
    setMessageContext(context);
    setSenderName(sender);
  }, []);

  // Handle using a draft from AI chat
  const handleUseDraftFromAi = useCallback((draft: string) => {
    setDraftTextFromAi(draft);
  }, []);

  // Clear draft text from AI after it's consumed
  const handleDraftTextFromAiConsumed = useCallback(() => {
    setDraftTextFromAi(undefined);
  }, []);

  // Handle send message
  const handleSend = useCallback(async (draftText: string) => {
    const chatId = composerDraft?.chatId || composerMessage?.chatId;

    if (!chatId) {
      toast.error('Cannot send: missing chat ID');
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch('/api/beeper/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId, text: draftText }),
      });

      const result = await response.json();

      if (result.error) {
        toast.error(`Failed to send: ${result.error}`);
        return;
      }

      // Delete draft if it exists
      if (composerDraft) {
        deleteDraft(composerDraft.id);
      }

      toast.success('Message sent!');

      // Refresh messages after a short delay
      setTimeout(refetch, 1000);
    } catch (err) {
      toast.error('Failed to send message');
    }
  }, [composerDraft, composerMessage, deleteDraft, refetch]);

  // Handle delete draft
  const handleDeleteDraft = useCallback(() => {
    if (composerDraft) {
      deleteDraft(composerDraft.id);
      toast.success('Draft deleted');
    }
  }, [composerDraft, deleteDraft]);

  // Handle send from message panel
  const handleSendFromPanel = useCallback(async (text: string) => {
    const chatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId;

    if (!chatId) {
      toast.error('Cannot send: missing chat ID');
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch('/api/beeper/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId, text }),
      });

      const result = await response.json();

      if (result.error) {
        toast.error(`Failed to send: ${result.error}`);
        throw new Error(result.error);
      }

      // Delete draft if sending from a draft card
      if (selectedCard?.type === 'draft' && selectedCard.draft) {
        deleteDraft(selectedCard.draft.id);
      }

      toast.success('Message sent!');

      // Refresh messages after a short delay
      setTimeout(refetch, 1000);
    } catch (err) {
      toast.error('Failed to send message');
      throw err;
    }
  }, [selectedCard, settings.beeperAccessToken, refetch, deleteDraft]);


  // Show loading while settings are being loaded
  if (!settingsLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show prompt to configure settings if no accounts selected
  if (settings.selectedAccountIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to Beeper Kanban</h1>
          <p className="mt-2 text-muted-foreground">
            Configure your platforms to get started
          </p>
        </div>
        <Link href="/settings">
          <Button size="lg">
            <Settings className="mr-2 h-5 w-5" />
            Configure Platforms
          </Button>
        </Link>
      </div>
    );
  }

  const isPanelOpen = selectedCard !== null;

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden p-6">
          {error ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg bg-destructive/10 p-6 text-center text-destructive">
                <p className="font-medium">Connection Error</p>
                <p className="text-sm">{error}</p>
                <Button variant="outline" className="mt-4" onClick={refetch}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-full flex justify-center">
              <div className="max-w-4xl w-full">
                <MessageBoard
                  unreadMessages={filteredUnreadMessages}
                  drafts={drafts}
                  sentMessages={sentMessages}
                  avatars={avatars}
                  chatInfo={chatInfo}
                  onCardClick={handleCardClick}
                  onMoveToColumn={handleMoveToColumn}
                  onArchive={handleArchive}
                  onHide={handleHide}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={loadMore}
                />
              </div>
            </div>
          )}
        </main>

        {/* Floating bottom bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white shadow-lg px-2 py-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={refetch}
            disabled={isLoading}
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Message panel sidebar with padding */}
      <div className={`shrink-0 flex gap-2 transition-all duration-300 ease-in-out ${isPanelOpen ? 'py-2 pr-2' : 'w-0'}`}>
        <MessagePanel
          card={isPanelOpen ? selectedCard : null}
          onClose={handleClosePanel}
          onSend={handleSendFromPanel}
          onSaveDraft={handleSaveDraftFromPanel}
          isAiChatOpen={isAiChatOpen}
          onToggleAiChat={handleToggleAiChat}
          draftTextFromAi={draftTextFromAi}
          onDraftTextFromAiConsumed={handleDraftTextFromAiConsumed}
          onMessageContextChange={handleMessageContextChange}
        />
        <AiChatPanel
          isOpen={isPanelOpen && isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          messageContext={messageContext}
          senderName={senderName}
          onUseDraft={handleUseDraftFromAi}
          messages={aiChatMessages}
          onMessagesChange={setAiChatMessages}
        />
      </div>

      {/* Message detail panel (for drafts) */}
      <MessageDetail
        card={selectedCard}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onReply={handleReply}
      />

      {/* Draft composer dialog */}
      <DraftComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        originalMessage={composerMessage}
        existingDraft={composerDraft}
        onSave={handleSaveDraft}
        onSend={handleSend}
        onDelete={composerMode === 'edit' ? handleDeleteDraft : undefined}
      />
    </div>
  );
}
