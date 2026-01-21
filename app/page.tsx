'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageBoard } from '@/components/kanban/message-board';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';
import { MessageDetail } from '@/components/message-detail';
import { DraftComposer } from '@/components/draft-composer';
import { MessagePanel } from '@/components/message-panel';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { ContactProfilePanel } from '@/components/contact-profile-panel';
import { ContactsDialog } from '@/components/contacts-dialog';
import { useCrm } from '@/hooks/use-crm';
import { HandoffSummaryCard } from '@/components/autopilot/handoff-summary-card';
import { ErrorState } from '@/components/dashboard/error-state';
import { LoadingState } from '@/components/dashboard/loading-state';
import { BottomNavigation, MainView } from '@/components/dashboard/bottom-navigation';
import { ContactsView } from '@/components/contacts-view';
import { FilterDialog } from '@/components/filter-dialog';
import { GroupByDialog } from '@/components/group-by-dialog';
import type { Contact } from '@/app/api/beeper/contacts/route';
import { useSettingsContext } from '@/contexts/settings-context';
import { useAuth } from '@/contexts/auth-context';
import { useMessages } from '@/hooks/use-messages';
import { useArchived } from '@/hooks/use-archived';
import { useDrafts } from '@/hooks/use-drafts';
import { useAiChatHistory } from '@/hooks/use-ai-chat-history';
import { useBatchDraftGenerator } from '@/hooks/use-batch-draft-generator';
import { useBatchSend } from '@/hooks/use-batch-send';
import { useSendMessage } from '@/hooks/use-send-message';
import { useAutopilot } from '@/contexts/autopilot-context';
import { KanbanCard, ColumnId, BeeperMessage, Draft } from '@/lib/types';
import { loadHiddenChats, addHiddenChat, loadWritingStylePatterns, loadToneSettings, getChatAutopilotConfig } from '@/lib/storage';
import { getBeeperHeaders, getAIHeaders, getEffectiveAiProvider } from '@/lib/api-headers';
import { toast } from 'sonner';

export default function Home() {
  const { settings, isLoaded: settingsLoaded, updateSettings, toggleAccount, selectAllAccounts, deselectAllAccounts } = useSettingsContext();
  const { subscription } = useAuth();

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
    poll,
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
  const { processNewMessages, handoffSummaries, dismissHandoff, configVersion } = useAutopilot();

  // Send message hook
  const { sendMessage } = useSendMessage({
    autoRefresh: true,
    refetch,
  });

  // Process new messages through autopilot when they arrive
  useEffect(() => {
    if (unreadMessages.length > 0) {
      processNewMessages(unreadMessages);
    }
  }, [unreadMessages, processNewMessages]);

  // Auto-poll for new messages every 10 seconds (silent background poll)
  useEffect(() => {
    const interval = setInterval(() => {
      poll();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [poll]);

  // Filter out optimistically archived chats and messages that have drafts
  // Memoize the Set to avoid recreating it on every render
  const draftChatIds = useMemo(() => new Set(drafts.map(d => d.chatId)), [drafts]);

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

  // View state - toggle between kanban and contacts
  const [currentView, setCurrentView] = useState<MainView>('kanban');

  // Contacts dialog state
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);

  // Filter dialog state
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<Set<string>>(new Set());
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<Set<'person' | 'group'>>(new Set());
  const [selectedChannelFilters, setSelectedChannelFilters] = useState<Set<string>>(new Set());

  // Group by dialog state
  const [groupByDialogOpen, setGroupByDialogOpen] = useState(false);

  // Get the current chat ID from selected card (for per-thread AI chat)
  const currentChatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId || null;
  const { messages: aiChatMessages, setMessages: setAiChatMessages } = useAiChatHistory(currentChatId);

  // CRM state
  const [isContactProfileOpen, setIsContactProfileOpen] = useState(false);
  const {
    contacts: crmContacts,
    tags: crmTags,
    getContactForChat,
    getOrCreateContactForChat,
    updateContact: updateCrmContact,
    deleteContact: deleteCrmContact,
    createTag: createCrmTag,
    deleteTag: deleteCrmTag,
    addTagToContact,
    removeTagFromContact,
    linkChatToContact,
    unlinkChatFromContact,
    mergeContacts: mergeCrmContacts,
    updateInteractionStats,
    search: searchCrmContacts,
  } = useCrm();

  // Auto-create contacts for all messages when they load
  useEffect(() => {
    // Only auto-create contacts if we have chatInfo populated (ensures isGroup is available)
    if (!isLoading && (unreadMessages.length > 0 || sentMessages.length > 0) && Object.keys(chatInfo).length > 0) {
      const allMessages = [...unreadMessages, ...sentMessages];

      // Group messages by chatId for stats calculation
      const messagesByChatId = new Map<string, BeeperMessage[]>();
      allMessages.forEach(msg => {
        if (!messagesByChatId.has(msg.chatId)) {
          messagesByChatId.set(msg.chatId, []);
        }
        messagesByChatId.get(msg.chatId)!.push(msg);
      });

      // Create contacts for unique chats and update their stats
      messagesByChatId.forEach((messages, chatId) => {
        const firstMsg = messages[0];
        // Extract platform from chatId (format: "platform:roomId")
        const platform = firstMsg.platform || chatId.split(':')[0] || 'unknown';
        // Get chat name and avatar from chatInfo if available
        const chat = chatInfo[chatId];
        const displayName = chat?.title || firstMsg.chatName || firstMsg.senderName;
        const avatarUrl = avatars[chatId] || firstMsg.senderAvatarUrl;
        // chatInfo is the authoritative source for isGroup
        const isGroup = chat?.isGroup;

        const contact = getOrCreateContactForChat(chatId, displayName, platform, firstMsg.accountId, avatarUrl, isGroup);

        // Update existing contact if isGroup is defined but contact doesn't have it set
        if (isGroup !== undefined && contact.isGroup !== isGroup) {
          updateCrmContact(contact.id, { isGroup });
        }

        // Update interaction stats with all messages from this chat
        const statsMessages = messages.map(msg => ({
          timestamp: msg.timestamp,
          isFromMe: msg.isFromMe,
        }));
        updateInteractionStats(contact.id, statsMessages);
      });
    }
  }, [unreadMessages, sentMessages, isLoading, getOrCreateContactForChat, chatInfo, avatars, updateCrmContact, updateInteractionStats]);

  // Get the current contact profile for the selected card
  const currentContact = currentChatId ? getContactForChat(currentChatId) : null;

  // Filter helper - check if message passes filter
  const messagePassesFilter = useCallback((message: BeeperMessage) => {
    const contact = getContactForChat(message.chatId);
    if (!contact) return true; // Show messages without contacts

    // Type filter
    if (selectedTypeFilters.size > 0) {
      const messageType = contact.isGroup ? 'group' : 'person';
      if (!selectedTypeFilters.has(messageType)) return false;
    }

    // Tag filter
    if (selectedTagFilters.size > 0) {
      if (!contact.tags.some(tag => selectedTagFilters.has(tag))) return false;
    }

    // Channel/platform filter
    if (selectedChannelFilters.size > 0) {
      if (!contact.platformLinks.some(link => selectedChannelFilters.has(link.platform))) return false;
    }

    return true;
  }, [getContactForChat, selectedTagFilters, selectedTypeFilters, selectedChannelFilters]);

  // Apply filters to messages
  const displayedUnreadMessages = useMemo(() =>
    filteredUnreadMessages.filter(messagePassesFilter),
    [filteredUnreadMessages, messagePassesFilter]
  );

  const displayedAutopilotMessages = useMemo(() =>
    autopilotMessages.filter(messagePassesFilter),
    [autopilotMessages, messagePassesFilter]
  );

  const displayedSentMessages = useMemo(() =>
    filteredSentMessages.filter(messagePassesFilter),
    [filteredSentMessages, messagePassesFilter]
  );

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
        const headers = getAIHeaders(settings);

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
            provider: getEffectiveAiProvider(settings),
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
        logger.error('Failed to generate draft:', error instanceof Error ? error : String(error));
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
      const headers = getBeeperHeaders(settings.beeperAccessToken);

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
      const headers = getBeeperHeaders(settings.beeperAccessToken);

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
    setIsContactProfileOpen(false);
  }, []);

  // Toggle AI chat panel
  const handleToggleAiChat = useCallback(() => {
    setIsAiChatOpen(prev => !prev);
  }, []);

  // Toggle contact profile panel
  const handleToggleContactProfile = useCallback(() => {
    // If opening and no contact exists yet, create one
    if (!isContactProfileOpen && !currentContact && selectedCard) {
      const card = selectedCard;
      const chatId = card.message?.chatId || card.draft?.chatId;
      const platform = card.message?.platform || card.draft?.platform || 'unknown';
      const accountId = card.message?.accountId || card.draft?.accountId || '';
      if (chatId) {
        getOrCreateContactForChat(chatId, card.title, platform, accountId, card.avatarUrl);
      }
    }
    setIsContactProfileOpen(prev => !prev);
  }, [isContactProfileOpen, currentContact, selectedCard, getOrCreateContactForChat]);

  // CRM handlers
  const handleSaveCrmContact = useCallback((contactId: string, updates: Partial<import('@/lib/types').CrmContactProfile>) => {
    updateCrmContact(contactId, updates);
  }, [updateCrmContact]);

  const handleCreateCrmTag = useCallback((name: string) => {
    return createCrmTag(name);
  }, [createCrmTag]);

  const handleAddCrmTag = useCallback((contactId: string, tagId: string) => {
    addTagToContact(contactId, tagId);
  }, [addTagToContact]);

  const handleRemoveCrmTag = useCallback((contactId: string, tagId: string) => {
    removeTagFromContact(contactId, tagId);
  }, [removeTagFromContact]);

  const handleUnlinkPlatform = useCallback((contactId: string, chatId: string) => {
    unlinkChatFromContact(contactId, chatId);
  }, [unlinkChatFromContact]);

  const handleLinkPlatform = useCallback((contactId: string, chatId: string, platform: string, accountId: string, displayName: string, avatarUrl?: string) => {
    linkChatToContact(contactId, chatId, platform, accountId, displayName, avatarUrl);
    toast.success('Platform linked to contact');
  }, [linkChatToContact]);

  const handleMergeCrmContacts = useCallback((targetContactId: string, sourceContactId: string) => {
    mergeCrmContacts(targetContactId, sourceContactId);
    toast.success('Contacts merged successfully');
    // Close the panel if the current contact was merged away
    if (currentContact?.id === sourceContactId) {
      setIsContactProfileOpen(false);
    }
  }, [mergeCrmContacts, currentContact]);

  // Handle message context change from MessagePanel
  const handleMessageContextChange = useCallback((context: string, sender: string) => {
    setMessageContext(context);
    setSenderName(sender);
  }, []);

  // Handle messages loaded - update CRM contact interaction stats
  const handleMessagesLoaded = useCallback((chatId: string, messages: Array<{ timestamp: string; isFromMe: boolean }>) => {
    const contact = getContactForChat(chatId);
    if (contact) {
      updateInteractionStats(contact.id, messages);
    }
  }, [getContactForChat, updateInteractionStats]);

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

    const result = await sendMessage(chatId, draftText);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }

    // Delete draft if it exists
    if (composerDraft) {
      deleteDraft(composerDraft.id);
    }
  }, [composerDraft, composerMessage, deleteDraft, sendMessage]);

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

    const result = await sendMessage(chatId, text);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }

    // Delete draft if sending from a draft card
    if (selectedCard?.type === 'draft' && selectedCard.draft) {
      deleteDraft(selectedCard.draft.id);
    }
  }, [selectedCard, sendMessage, deleteDraft]);

  // Get available channels from contacts
  const availableChannels = useMemo(() => {
    const channels = new Set<string>();
    Object.values(crmContacts).forEach(contact => {
      contact.platformLinks.forEach(link => {
        channels.add(link.platform);
      });
    });
    return Array.from(channels).sort();
  }, [crmContacts]);

  // Filter toggle handlers
  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  }, []);

  const toggleTypeFilter = useCallback((type: 'person' | 'group') => {
    setSelectedTypeFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, []);

  const toggleChannelFilter = useCallback((channel: string) => {
    setSelectedChannelFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channel)) {
        newSet.delete(channel);
      } else {
        newSet.add(channel);
      }
      return newSet;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedTagFilters(new Set());
    setSelectedTypeFilters(new Set());
    setSelectedChannelFilters(new Set());
  }, []);


  // Show loading while settings are being loaded
  if (!settingsLoaded) {
    return (
      <div className="flex min-h-screen">
        <LoadingState />
      </div>
    );
  }

  // Show onboarding if setup is incomplete
  const isOnboardingComplete = !!settings.beeperAccessToken && settings.selectedAccountIds.length > 0;

  if (!isOnboardingComplete) {
    return (
      <OnboardingChecklist
        settings={settings}
        updateSettings={updateSettings}
        toggleAccount={toggleAccount}
        selectAllAccounts={selectAllAccounts}
        deselectAllAccounts={deselectAllAccounts}
      />
    );
  }

  const isPanelOpen = selectedCard !== null;

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden pt-10 pl-6">
          {currentView === 'kanban' ? (
            error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : isLoading && unreadMessages.length === 0 && sentMessages.length === 0 ? (
              <LoadingState />
            ) : (
              <div className="h-full overflow-x-auto">
                <MessageBoard
                  groupBy={settings.kanbanGroupBy ?? 'status'}
                  unreadMessages={displayedUnreadMessages}
                  autopilotMessages={displayedAutopilotMessages}
                  drafts={drafts}
                  sentMessages={displayedSentMessages}
                  archivedMessages={archivedMessages}
                  showArchivedColumn={settings.showArchivedColumn}
                  onToggleArchived={() => updateSettings({ showArchivedColumn: !settings.showArchivedColumn })}
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
            )
          ) : (
            <div className="h-full pr-6">
              <ContactsView
                contacts={crmContacts}
                tags={crmTags}
                deleteContact={deleteCrmContact}
                createTag={createCrmTag}
                deleteTag={deleteCrmTag}
                addTagToContact={addTagToContact}
                removeTagFromContact={removeTagFromContact}
                search={searchCrmContacts}
                updateContact={updateCrmContact}
                showHeader={false}
              />
            </div>
          )}
        </main>

        {/* Floating bottom bar with contacts overlay */}
        <div className="fixed bottom-6 left-[320px] -translate-x-1/2 z-10 flex flex-col items-center">
          {/* Trial indicator */}
          {subscription?.status === 'trialing' && subscription.daysRemaining !== null && (
            <Link href="/settings/account" className="mb-2">
              <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors">
                {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'} left in trial
              </div>
            </Link>
          )}

          {/* Contacts overlay - positioned above bottom bar */}
          <ContactsDialog
            open={contactsDialogOpen}
            onOpenChange={setContactsDialogOpen}
            onSelectContact={handleContactSelect}
          />

          {/* Filter Dialog - positioned above bottom bar */}
          <FilterDialog
            open={filterDialogOpen}
            onOpenChange={setFilterDialogOpen}
            tags={crmTags}
            availableChannels={availableChannels}
            selectedTagFilters={selectedTagFilters}
            selectedTypeFilters={selectedTypeFilters}
            selectedChannelFilters={selectedChannelFilters}
            onToggleTag={toggleTagFilter}
            onToggleType={toggleTypeFilter}
            onToggleChannel={toggleChannelFilter}
            onClearAll={clearAllFilters}
          />

          {/* Group By Dialog - positioned above bottom bar */}
          <GroupByDialog
            open={groupByDialogOpen}
            onOpenChange={setGroupByDialogOpen}
            groupBy={settings.kanbanGroupBy ?? 'status'}
            onGroupByChange={(groupBy) => updateSettings({ kanbanGroupBy: groupBy })}
          />

          {/* Bottom nav */}
          <BottomNavigation
            onNewContact={() => {
              setFilterDialogOpen(false);
              setGroupByDialogOpen(false);
              setContactsDialogOpen(true);
            }}
            groupBy={settings.kanbanGroupBy ?? 'status'}
            onGroupByChange={(groupBy) => updateSettings({ kanbanGroupBy: groupBy })}
            currentView={currentView}
            onViewChange={setCurrentView}
            onFilterClick={() => {
              setContactsDialogOpen(false);
              setGroupByDialogOpen(false);
              setFilterDialogOpen(true);
            }}
            onGroupByClick={() => {
              setContactsDialogOpen(false);
              setFilterDialogOpen(false);
              setGroupByDialogOpen(true);
            }}
            hasActiveFilters={selectedTagFilters.size > 0 || selectedTypeFilters.size > 0 || selectedChannelFilters.size > 0}
          />
        </div>
      </div>


      {/* Floating panels - fixed position on right side */}
      <div className={`fixed top-4 right-4 bottom-4 flex gap-4 transition-all duration-300 ease-in-out z-20 ${isPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <ContactProfilePanel
          contact={currentContact}
          allContacts={crmContacts}
          tags={crmTags}
          isOpen={isPanelOpen && isContactProfileOpen}
          onClose={() => setIsContactProfileOpen(false)}
          onSave={handleSaveCrmContact}
          onCreateTag={handleCreateCrmTag}
          onAddTag={handleAddCrmTag}
          onRemoveTag={handleRemoveCrmTag}
          onUnlinkPlatform={handleUnlinkPlatform}
          onMerge={handleMergeCrmContacts}
          onLinkPlatform={handleLinkPlatform}
        />
        <MessagePanel
          card={isPanelOpen ? selectedCard : null}
          onClose={handleClosePanel}
          onSend={handleSendFromPanel}
          onSaveDraft={handleSaveDraftFromPanel}
          isAiChatOpen={isAiChatOpen}
          onToggleAiChat={handleToggleAiChat}
          isContactProfileOpen={isContactProfileOpen}
          onToggleContactProfile={handleToggleContactProfile}
          draftTextFromAi={draftTextFromAi}
          onDraftTextFromAiConsumed={handleDraftTextFromAiConsumed}
          onMessageContextChange={handleMessageContextChange}
          onMessagesLoaded={handleMessagesLoaded}
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
      {handoffSummaries.size > 0 && (
        <div className="fixed bottom-20 left-6 z-30 w-80 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
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
