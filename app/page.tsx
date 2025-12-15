'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Settings, RefreshCw, Loader2, Plus, Archive } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { MessageBoard } from '@/components/kanban/message-board';
import { MessageDetail } from '@/components/message-detail';
import { DraftComposer } from '@/components/draft-composer';
import { MessagePanel } from '@/components/message-panel';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { ContactsDialog } from '@/components/contacts-dialog';
import { PendingApprovalCard } from '@/components/autopilot/pending-approval-card';
import { HandoffSummaryCard } from '@/components/autopilot/handoff-summary-card';
import type { Contact } from '@/app/api/beeper/contacts/route';
import { useSettingsContext } from '@/contexts/settings-context';
import { useMessages } from '@/hooks/use-messages';
import { useArchived } from '@/hooks/use-archived';
import { useDrafts } from '@/hooks/use-drafts';
import { useAiChatHistory } from '@/hooks/use-ai-chat-history';
import { useBatchDraftGenerator } from '@/hooks/use-batch-draft-generator';
import { useBatchSend } from '@/hooks/use-batch-send';
import { useAutopilot } from '@/contexts/autopilot-context';
import { KanbanCard, ColumnId, BeeperMessage, Draft } from '@/lib/types';
import { loadHiddenChats, addHiddenChat, loadWritingStylePatterns, loadToneSettings, getChatAutopilotConfig } from '@/lib/storage';
import { toast } from 'sonner';

export default function Home() {
  const { settings, isLoaded: settingsLoaded, updateSettings } = useSettingsContext();

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

  // Fetch archived messages only when showArchivedColumn is enabled
  const {
    archivedMessages,
    refetch: refetchArchived,
  } = useArchived(settings.selectedAccountIds, settings.showArchivedColumn);

  const { drafts, createDraft, updateDraft, deleteDraft } = useDrafts();

  // Autopilot integration
  const { processNewMessages, pendingApprovals, handoffSummaries, approveDraft, rejectDraft, dismissHandoff, configVersion } = useAutopilot();

  // Process new messages through autopilot when they arrive
  useEffect(() => {
    if (unreadMessages.length > 0) {
      processNewMessages(unreadMessages);
    }
  }, [unreadMessages, processNewMessages]);

  // Auto-poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  // Filter out optimistically archived chats and messages that have drafts
  const draftChatIds = new Set(drafts.map(d => d.chatId));

  // Collect autopilot chats from ALL message sources (unread + sent)
  // The autopilot column should show chats with active autopilot regardless of their other state
  const { autopilotMessages, filteredUnreadMessages, filteredSentMessages } = useMemo(() => {
    const autopilotChatIds = new Set<string>();
    const autopilot: BeeperMessage[] = [];
    const regularUnread: BeeperMessage[] = [];

    // First, identify all chats with active autopilot by checking unread messages
    for (const m of unreadMessages) {
      if (archivedChats.has(m.chatId)) continue;
      const config = getChatAutopilotConfig(m.chatId);
      if (config?.enabled && config.status === 'active') {
        autopilotChatIds.add(m.chatId);
        autopilot.push(m);
      } else if (!draftChatIds.has(m.chatId)) {
        regularUnread.push(m);
      }
    }

    // Also check sent messages for active autopilot (chat could be waiting for reply)
    for (const m of sentMessages) {
      if (archivedChats.has(m.chatId)) continue;
      if (autopilotChatIds.has(m.chatId)) continue; // Already added from unread
      const config = getChatAutopilotConfig(m.chatId);
      if (config?.enabled && config.status === 'active') {
        autopilotChatIds.add(m.chatId);
        autopilot.push(m);
      }
    }

    // Filter sent messages to exclude autopilot chats (they show in autopilot column)
    const regularSent = sentMessages.filter(m => !autopilotChatIds.has(m.chatId));

    return {
      autopilotMessages: autopilot,
      filteredUnreadMessages: regularUnread,
      filteredSentMessages: regularSent,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadMessages, sentMessages, archivedChats, draftChatIds, configVersion]);

  // Batch draft generation
  const handleDraftGenerated = useCallback((message: BeeperMessage, draftText: string) => {
    const avatarUrl = chatInfo?.[message.chatId]?.isGroup
      ? undefined
      : (avatars?.[message.chatId] || message.senderAvatarUrl);
    const isGroup = chatInfo?.[message.chatId]?.isGroup;
    createDraft(message, draftText, avatarUrl, isGroup);
  }, [createDraft, avatars, chatInfo]);

  const {
    isGenerating: isGeneratingDrafts,
    progress: generatingProgress,
    generateAllDrafts,
    cancelGeneration,
  } = useBatchDraftGenerator({
    onDraftGenerated: handleDraftGenerated,
  });

  const handleGenerateAllDrafts = useCallback(() => {
    // Filter out messages that already have drafts
    const existingDraftChatIds = new Set(drafts.map(d => d.chatId));
    const messagesWithoutDrafts = filteredUnreadMessages.filter(
      m => !existingDraftChatIds.has(m.chatId)
    );

    if (messagesWithoutDrafts.length === 0) {
      toast.info('All messages already have drafts');
      return;
    }

    toast.info(`Generating drafts for ${messagesWithoutDrafts.length} messages...`);
    generateAllDrafts(messagesWithoutDrafts);
  }, [filteredUnreadMessages, drafts, generateAllDrafts]);

  // Batch send drafts
  const handleDraftSent = useCallback((draft: Draft) => {
    deleteDraft(draft.id);
  }, [deleteDraft]);

  const {
    isSending: isSendingAllDrafts,
    progress: sendingProgress,
    sendAllDrafts,
    cancelSending,
  } = useBatchSend({
    onDraftSent: handleDraftSent,
  });

  const handleSendAllDrafts = useCallback(() => {
    if (drafts.length === 0) {
      toast.info('No drafts to send');
      return;
    }

    toast.info(`Sending ${drafts.length} drafts...`);
    sendAllDrafts(drafts);
  }, [drafts, sendAllDrafts]);

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

  // Contacts dialog state
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);

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

  // Handle dragging card to drafts column - auto-generate draft with optimistic UI
  const handleMoveToColumn = useCallback(async (card: KanbanCard, fromColumn: ColumnId, toColumn: ColumnId) => {
    if (fromColumn === 'unread' && toColumn === 'drafts' && card.type === 'message' && card.message) {
      const message = card.message;

      // Immediately create an optimistic draft with placeholder text
      const avatarUrl = chatInfo?.[message.chatId]?.isGroup
        ? undefined
        : (avatars?.[message.chatId] || message.senderAvatarUrl);
      const isGroup = chatInfo?.[message.chatId]?.isGroup;
      const optimisticDraft = createDraft(message, 'Generating response...', avatarUrl, isGroup);

      // Show loading toast
      const toastId = toast.loading('Generating draft...');

      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (settings.anthropicApiKey && settings.aiProvider !== 'ollama') {
          headers['x-anthropic-key'] = settings.anthropicApiKey;
        }

        const toneSettings = loadToneSettings();
        const writingStyle = loadWritingStylePatterns();

        const response = await fetch('/api/ai/draft', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            originalMessage: message.text,
            senderName: message.senderName,
            toneSettings,
            writingStyle: writingStyle.sampleMessages.length > 0 ? writingStyle : undefined,
            provider: settings.aiProvider || 'anthropic',
            ollamaModel: settings.ollamaModel,
            ollamaBaseUrl: settings.ollamaBaseUrl,
          }),
        });

        const result = await response.json();

        if (result.data?.suggestedReply) {
          // Update the optimistic draft with AI-generated text
          updateDraft(optimisticDraft.id, { draftText: result.data.suggestedReply });
          toast.success('Draft created', { id: toastId });
        } else if (result.error) {
          // Keep the draft but show error
          updateDraft(optimisticDraft.id, { draftText: '' });
          toast.error(result.error, { id: toastId });
        } else {
          updateDraft(optimisticDraft.id, { draftText: '' });
          toast.error('Failed to generate draft', { id: toastId });
        }
      } catch (error) {
        console.error('Failed to generate draft:', error);
        // Keep the draft but clear placeholder
        updateDraft(optimisticDraft.id, { draftText: '' });
        toast.error('Failed to generate draft', { id: toastId });
      }
    }
  }, [settings.anthropicApiKey, settings.aiProvider, settings.ollamaModel, settings.ollamaBaseUrl, avatars, chatInfo, createDraft, updateDraft]);

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
      // Refresh archived list if showing
      if (settings.showArchivedColumn) {
        refetchArchived();
      }
    } catch {
      // Revert optimistic update on error
      setArchivedChats(prev => {
        const updated = new Set(prev);
        updated.delete(chatId);
        return updated;
      });
      toast.error('Failed to archive chat');
    }
  }, [settings.beeperAccessToken, settings.showArchivedColumn, refetchArchived]);

  // Handle unarchive chat
  const handleUnarchive = useCallback(async (card: KanbanCard) => {
    const chatId = card.message?.chatId;
    if (!chatId) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch(`/api/beeper/chats/${encodeURIComponent(chatId)}/unarchive`, {
        method: 'POST',
        headers,
      });

      const result = await response.json();

      if (result.error) {
        toast.error(`Failed to unarchive: ${result.error}`);
        return;
      }

      toast.success('Chat unarchived');
      // Refresh both lists
      refetch();
      refetchArchived();
    } catch {
      toast.error('Failed to unarchive chat');
    }
  }, [settings.beeperAccessToken, refetch, refetchArchived]);

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

  // Handle contact selection from contacts dialog
  const handleContactSelect = useCallback((contact: Contact) => {
    // Create a synthetic message to represent the new conversation
    const syntheticMessage: BeeperMessage = {
      id: `new-${contact.chatId}-${Date.now()}`,
      chatId: contact.chatId,
      accountId: contact.accountId,
      senderId: '',
      senderName: contact.name,
      senderAvatarUrl: contact.avatarUrl,
      text: '',
      timestamp: new Date().toISOString(),
      isFromMe: false,
      isRead: true,
      chatName: contact.name,
      platform: contact.platform,
      isGroup: contact.isGroup,
    };

    // Create a card for the message panel
    const card: KanbanCard = {
      id: syntheticMessage.id,
      type: 'message',
      message: syntheticMessage,
      title: contact.name,
      preview: '',
      timestamp: syntheticMessage.timestamp,
      platform: contact.platform,
      avatarUrl: contact.avatarUrl,
      isGroup: contact.isGroup,
    };

    // Open the side panel with this card
    setSelectedCard(card);
  }, []);

  // Handle send message
  const handleSend = useCallback(async (draftText: string) => {
    const chatId = composerDraft?.chatId || composerMessage?.chatId;

    if (!chatId) {
      throw new Error('Cannot send: missing chat ID');
    }

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
      throw new Error(result.error);
    }

    // Delete draft if it exists
    if (composerDraft) {
      deleteDraft(composerDraft.id);
    }

    // Refresh messages after a short delay
    setTimeout(refetch, 1000);
  }, [composerDraft, composerMessage, deleteDraft, refetch, settings.beeperAccessToken]);

  // Handle delete draft (from composer)
  const handleDeleteDraft = useCallback(() => {
    if (composerDraft) {
      deleteDraft(composerDraft.id);
      toast.success('Draft deleted');
    }
  }, [composerDraft, deleteDraft]);

  // Handle delete draft from card (in kanban board)
  const handleDeleteDraftFromCard = useCallback((card: KanbanCard) => {
    if (card.type === 'draft' && card.draft) {
      deleteDraft(card.draft.id);
      toast.success('Draft deleted');
    }
  }, [deleteDraft]);

  // Handle send from message panel
  const handleSendFromPanel = useCallback(async (text: string) => {
    const chatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId;

    if (!chatId) {
      throw new Error('Cannot send: missing chat ID');
    }

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
      throw new Error(result.error);
    }

    // Delete draft if sending from a draft card
    if (selectedCard?.type === 'draft' && selectedCard.draft) {
      deleteDraft(selectedCard.draft.id);
    }

    // Refresh messages after a short delay
    setTimeout(refetch, 1000);
  }, [selectedCard, settings.beeperAccessToken, refetch, deleteDraft]);


  // Show loading while settings are being loaded
  if (!settingsLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  // Show prompt to configure settings if no accounts selected
  if (settings.selectedAccountIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="text-center">
          <h1 className="text-xs font-medium">Welcome to Beeper Kanban</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Configure your platforms to get started
          </p>
        </div>
        <Link href="/settings">
          <Button size="lg">
            <Settings className="h-4 w-4 mr-2" strokeWidth={1.5} />
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
        <main className="flex-1 overflow-hidden pt-6 pl-6">
          {error ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg bg-destructive/10 p-6 text-center text-destructive">
                <p className="text-xs font-medium">Connection Error</p>
                <p className="text-xs">{error}</p>
                <Button variant="outline" className="mt-4" onClick={refetch}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : isLoading && unreadMessages.length === 0 && sentMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="h-full overflow-x-auto">
              <MessageBoard
                unreadMessages={filteredUnreadMessages}
                autopilotMessages={autopilotMessages}
                drafts={drafts}
                sentMessages={filteredSentMessages}
                archivedMessages={archivedMessages}
                showArchivedColumn={settings.showArchivedColumn}
                avatars={avatars}
                chatInfo={chatInfo}
                onCardClick={handleCardClick}
                onMoveToColumn={handleMoveToColumn}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onHide={handleHide}
                onDeleteDraft={handleDeleteDraftFromCard}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                onGenerateAllDrafts={handleGenerateAllDrafts}
                isGeneratingDrafts={isGeneratingDrafts}
                generatingProgress={generatingProgress ?? undefined}
                onCancelGeneration={cancelGeneration}
                onSendAllDrafts={handleSendAllDrafts}
                isSendingAllDrafts={isSendingAllDrafts}
                sendingProgress={sendingProgress ?? undefined}
                onCancelSending={cancelSending}
              />
            </div>
          )}
        </main>

        {/* Floating bottom bar with contacts overlay */}
        <div className="fixed bottom-6 left-[320px] -translate-x-1/2 z-10 flex flex-col items-center">
          {/* Contacts overlay - positioned above bottom bar */}
          <ContactsDialog
            open={contactsDialogOpen}
            onOpenChange={setContactsDialogOpen}
            onSelectContact={handleContactSelect}
          />

          {/* Bottom nav */}
          <div className="flex items-center gap-2 rounded-full bg-white dark:bg-card shadow-lg dark:border px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setContactsDialogOpen(true)}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </Button>
            <Button
              variant={settings.showArchivedColumn ? "default" : "ghost"}
              size="icon"
              className="rounded-full"
              onClick={() => updateSettings({ showArchivedColumn: !settings.showArchivedColumn })}
              title={settings.showArchivedColumn ? "Hide archived column" : "Show archived column"}
            >
              <Archive className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <ThemeToggle />
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Floating panels - fixed position on right side */}
      <div className={`fixed top-4 right-4 bottom-4 flex gap-4 transition-all duration-300 ease-in-out z-20 ${isPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
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

      {/* Autopilot notifications - floating in bottom left */}
      {(pendingApprovals.length > 0 || handoffSummaries.size > 0) && (
        <div className="fixed bottom-20 left-6 z-30 w-80 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
          {/* Pending approvals */}
          {pendingApprovals.map((approval) => (
            <PendingApprovalCard
              key={approval.chatId}
              chatId={approval.chatId}
              draftText={approval.draftText}
              agentName={approval.agentName}
              recipientName={approval.recipientName}
              timestamp={approval.timestamp}
              onApprove={approveDraft}
              onReject={rejectDraft}
            />
          ))}
          {/* Handoff summaries */}
          {Array.from(handoffSummaries.values()).map((summary) => (
            <HandoffSummaryCard
              key={summary.chatId}
              summary={summary}
              onDismiss={dismissHandoff}
            />
          ))}
        </div>
      )}

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
