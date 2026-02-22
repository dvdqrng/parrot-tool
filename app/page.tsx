'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MessageBoard } from '@/components/kanban/message-board';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';
import { MessagePanel } from '@/components/message-panel';
import { ContactsDialog } from '@/components/contacts-dialog';
import { useCrm } from '@/hooks/use-crm';
import { ErrorState } from '@/components/dashboard/error-state';
import { LoadingState } from '@/components/dashboard/loading-state';
import { BottomNavigation, MainView } from '@/components/dashboard/bottom-navigation';
import { GlobalStream } from '@/components/intelligence/global-stream';
import { AttentionSummary } from '@/components/intelligence/attention-summary';
import { ContactsView } from '@/components/contacts-view';
import { FilterDialog } from '@/components/filter-dialog';
import { GroupByDialog } from '@/components/group-by-dialog';
import type { Contact } from '@/app/api/beeper/contacts/route';
import { useSettingsContext } from '@/contexts/settings-context';
import { useAuth } from '@/contexts/auth-context';
import { useBeeperData } from '@/hooks/use-beeper-data';
import { useDrafts } from '@/hooks/use-drafts';
import { useBatchSend } from '@/hooks/use-batch-send';
import { useSendMessage } from '@/hooks/use-send-message';
import { KanbanCard, BeeperMessage, Draft, ContactAttachment } from '@/lib/types';
import { loadHiddenChats, addHiddenChat } from '@/lib/storage';
import { getBeeperHeaders } from '@/lib/api-headers';
import { toast } from 'sonner';

export default function Home() {
  const { settings, isLoaded: settingsLoaded, updateSettings, toggleAccount, selectAllAccounts, deselectAllAccounts } = useSettingsContext();
  const { subscription } = useAuth();

  // Use unified Beeper data hook
  const {
    unreadMessages,
    sentMessages,
    archivedMessages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    avatars,
    chatInfo,
    hiddenChatIds: hiddenChats,
    setHiddenChatIds: setHiddenChats,
    setSelectedAccountIds,
  } = useBeeperData();

  // Optimistically archived chats (for immediate UI feedback)
  const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set());

  // Sync selected account IDs with context
  useEffect(() => {
    setSelectedAccountIds(settings.selectedAccountIds);
  }, [settings.selectedAccountIds, setSelectedAccountIds]);

  // Load hidden chats on mount
  useEffect(() => {
    const stored = loadHiddenChats();
    setHiddenChats(stored);
  }, [setHiddenChats]);

  const { drafts, createDraft, updateDraft, deleteDraft } = useDrafts();

  // Send message hook
  const { sendMessage } = useSendMessage({
    autoRefresh: true,
    refetch,
  });

  // Filter out optimistically archived chats and messages that have drafts
  // Memoize the Set to avoid recreating it on every render
  const draftChatIds = useMemo(() => new Set(drafts.map(d => d.chatId)), [drafts]);

  // Filter messages
  const { filteredUnreadMessages, filteredSentMessages } = useMemo(() => {
    const regularUnread: BeeperMessage[] = [];

    for (const m of unreadMessages) {
      if (archivedChats.has(m.chatId)) continue;
      if (!draftChatIds.has(m.chatId)) {
        regularUnread.push(m);
      }
    }

    // Filter sent messages to exclude chats with drafts
    const regularSent = sentMessages.filter(m => !draftChatIds.has(m.chatId));

    return {
      filteredUnreadMessages: regularUnread,
      filteredSentMessages: regularSent,
    };
  }, [unreadMessages, sentMessages, archivedChats, draftChatIds]);

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

  // Get the current chat ID from selected card (for per-thread context)
  const currentChatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId || null;

  // CRM state
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
  // We use unreadCount from the API to show accurate received message counts
  useEffect(() => {
    // Only auto-create contacts if we have chatInfo populated (ensures isGroup is available)
    if (!isLoading && (unreadMessages.length > 0 || sentMessages.length > 0) && Object.keys(chatInfo).length > 0) {
      const allMessages = [...unreadMessages, ...sentMessages];
      const seenChatIds = new Set<string>();

      // Create contacts for unique chats
      for (const msg of allMessages) {
        if (seenChatIds.has(msg.chatId)) continue;
        seenChatIds.add(msg.chatId);

        // Extract platform from chatId (format: "platform:roomId")
        const platform = msg.platform || msg.chatId.split(':')[0] || 'unknown';
        // Get chat name and avatar from chatInfo if available
        const chat = chatInfo[msg.chatId];
        const displayName = chat?.title || msg.chatName || msg.senderName;
        const avatarUrl = avatars[msg.chatId] || msg.senderAvatarUrl;
        // chatInfo is the authoritative source for isGroup
        const isGroup = chat?.isGroup;

        const contact = getOrCreateContactForChat(msg.chatId, displayName, platform, msg.accountId, avatarUrl, isGroup);

        // Update contact stats using available data:
        // - unreadCount: number of unread messages received from this contact
        // - isFromMe: whether the most recent message is from me
        const messagesReceived = msg.unreadCount || 0;
        const messagesSent = msg.isFromMe ? 1 : 0;
        const totalMessageCount = messagesReceived + messagesSent;

        // Only update if we have meaningful data AND it's different from current
        const needsUpdate =
          (isGroup !== undefined && contact.isGroup !== isGroup) ||
          (totalMessageCount > 0 && (
            contact.messagesReceived !== messagesReceived ||
            contact.messagesSent !== messagesSent
          ));

        if (needsUpdate) {
          updateCrmContact(contact.id, {
            ...(isGroup !== undefined && { isGroup }),
            ...(totalMessageCount > 0 && {
              totalMessageCount,
              messagesReceived,
              messagesSent,
              lastInteractionAt: msg.timestamp,
            }),
          });
        }
      }
    }
  }, [unreadMessages, sentMessages, isLoading, getOrCreateContactForChat, chatInfo, avatars, updateCrmContact]);

  // Contact selected from the contacts list view (separate from card-based selection)
  const [selectedListContactId, setSelectedListContactId] = useState<string | null>(null);
  const selectedListContact = selectedListContactId ? crmContacts[selectedListContactId] || null : null;

  // Get the current contact profile — from list selection or selected card
  const currentContact = selectedListContact || (currentChatId ? getContactForChat(currentChatId) : null);

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

  const displayedSentMessages = useMemo(() =>
    filteredSentMessages.filter(messagePassesFilter),
    [filteredSentMessages, messagePassesFilter]
  );

  // Handle card click - open panel for both messages and drafts
  const handleCardClick = useCallback((card: KanbanCard) => {
    // Toggle selection - if clicking same card, deselect it
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }, []);

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
      // Refresh to update archived list
      refetch();
    } catch {
      // Revert optimistic update on error
      setArchivedChats(prev => {
        const updated = new Set(prev);
        updated.delete(chatId);
        return updated;
      });
      toast.error('Failed to archive chat');
    }
  }, [settings.beeperAccessToken, refetch]);

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
      // Refresh to update both regular and archived lists
      refetch();
    } catch {
      toast.error('Failed to unarchive chat');
    }
  }, [settings.beeperAccessToken, refetch]);

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

  // Handle save draft from MessagePanel
  const handleSaveDraftFromPanel = useCallback((draftText: string) => {
    // If viewing a draft, update it
    if (selectedCard?.type === 'draft' && selectedCard.draft) {
      updateDraft(selectedCard.draft.id, { draftText });
      return;
    }

    // If viewing a message, check if a draft already exists for this chat
    const message = selectedCard?.message;
    if (!message) return;

    const existingDraft = drafts.find(d => d.chatId === message.chatId);
    if (existingDraft) {
      // Update the existing draft
      updateDraft(existingDraft.id, { draftText });
      return;
    }

    // Create a new draft only if none exists
    const avatarUrl = chatInfo?.[message.chatId]?.isGroup
      ? undefined
      : (avatars?.[message.chatId] || message.senderAvatarUrl);
    const isGroup = chatInfo?.[message.chatId]?.isGroup;
    createDraft(message, draftText, avatarUrl, isGroup);
  }, [selectedCard, drafts, createDraft, updateDraft, avatars, chatInfo]);

  // Handle clearing draft from MessagePanel (when text becomes empty)
  const handleClearDraftFromPanel = useCallback(() => {
    if (selectedCard?.type === 'draft' && selectedCard.draft) {
      deleteDraft(selectedCard.draft.id);
      return;
    }

    // If viewing a message, check if a draft exists for this chat and delete it
    const message = selectedCard?.message;
    if (message) {
      const existingDraft = drafts.find(d => d.chatId === message.chatId);
      if (existingDraft) {
        deleteDraft(existingDraft.id);
      }
    }
  }, [selectedCard, drafts, deleteDraft]);

  // Handle closing the message panel
  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
    setSelectedListContactId(null);
  }, []);

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
  }, [mergeCrmContacts]);

  // Attachment handlers
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.heic': 'image/heic', '.pdf': 'application/pdf',
    '.doc': 'application/msword', '.txt': 'text/plain', '.csv': 'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.rtf': 'application/rtf',
  };

  const processAttachmentFiles = useCallback(async (
    contact: import('@/lib/types').CrmContactProfile,
    fileEntries: { name: string; size: number; path?: string; file?: File }[],
  ) => {
    const newAttachments: ContactAttachment[] = [];

    for (const entry of fileEntries) {
      const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()?.toLowerCase()}` : '';
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const storedName = `${id}${ext}`;

      // Electron path: use IPC to copy file by path
      if (entry.path && window.electron?.copyFileToAttachments) {
        const result = await window.electron.copyFileToAttachments(entry.path, storedName);
        if (!result.success) {
          toast.error(`Failed to add ${entry.name}`);
          continue;
        }
      }
      // Browser path: upload via API
      else if (entry.file) {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('storedName', storedName);
        const res = await fetch('/api/attachments', { method: 'POST', body: formData });
        if (!res.ok) {
          toast.error(`Failed to add ${entry.name}`);
          continue;
        }
      } else {
        continue;
      }

      newAttachments.push({
        id,
        fileName: entry.name,
        storedName,
        mimeType: mimeTypes[ext] || 'application/octet-stream',
        fileSize: entry.size,
        addedAt: new Date().toISOString(),
      });
    }

    if (newAttachments.length > 0) {
      const existing = contact.attachments || [];
      updateCrmContact(contact.id, { attachments: [...existing, ...newAttachments] });
      toast.success(`Added ${newAttachments.length} attachment${newAttachments.length > 1 ? 's' : ''}`);
    }
  }, [updateCrmContact]);

  const handleAddAttachments = useCallback(async () => {
    const contact = currentContact;
    if (!contact) return;

    // Electron: use native file dialog
    if (window.electron?.selectFiles) {
      const files = await window.electron.selectFiles();
      if (!files) return;
      await processAttachmentFiles(
        contact,
        files.map(f => ({ name: f.name, size: f.size, path: f.path })),
      );
      return;
    }

    // Browser fallback: hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.svg,.heic';
    input.onchange = async () => {
      const fileList = input.files;
      if (!fileList || fileList.length === 0) return;
      const entries = Array.from(fileList).map(f => ({ name: f.name, size: f.size, file: f }));
      await processAttachmentFiles(contact, entries);
    };
    input.click();
  }, [currentContact, processAttachmentFiles]);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    const contact = currentContact;
    if (!contact?.attachments) return;

    const att = contact.attachments.find(a => a.id === attachmentId);
    if (att) {
      // Electron: use IPC
      if (window.electron?.deleteAttachmentFile) {
        await window.electron.deleteAttachmentFile(att.storedName);
      } else {
        // Browser fallback: use DELETE API
        await fetch(`/api/attachments?name=${encodeURIComponent(att.storedName)}`, { method: 'DELETE' });
      }
    }

    updateCrmContact(contact.id, {
      attachments: contact.attachments.filter(a => a.id !== attachmentId),
    });
  }, [currentContact, updateCrmContact]);

  // Handle messages loaded - update CRM contact interaction stats
  const handleMessagesLoaded = useCallback((chatId: string, messages: Array<{ timestamp: string; isFromMe: boolean }>) => {
    const contact = getContactForChat(chatId);
    if (contact) {
      updateInteractionStats(contact.id, messages);
    }
  }, [getContactForChat, updateInteractionStats]);

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

  // Handle attention summary click — find matching card and select it
  const handleAttentionSelect = useCallback((chatId: string) => {
    const allMessages = [...unreadMessages, ...sentMessages];
    const msg = allMessages.find(m => m.chatId === chatId);
    if (msg) {
      const card: KanbanCard = {
        id: msg.id,
        type: 'message',
        message: msg,
        title: msg.chatName || msg.senderName,
        preview: msg.text || '',
        timestamp: msg.timestamp,
        platform: msg.platform || 'unknown',
        avatarUrl: avatars[msg.chatId] || msg.senderAvatarUrl,
      };
      setSelectedCard(card);
    }
  }, [unreadMessages, sentMessages, avatars]);

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

  const isPanelOpen = selectedCard !== null || selectedListContactId !== null;

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
                  drafts={drafts}
                  sentMessages={displayedSentMessages}
                  archivedMessages={archivedMessages}
                  showArchivedColumn={settings.showArchivedColumn}
                  onToggleArchived={() => updateSettings({ showArchivedColumn: !settings.showArchivedColumn })}
                  avatars={avatars}
                  chatInfo={chatInfo}
                  onCardClick={handleCardClick}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  onHide={handleHide}
                  onDeleteDraft={handleDeleteDraftFromCard}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={loadMore}
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
                onContactClick={(contact) => {
                  setSelectedListContactId(contact.id);
                }}
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

          {/* Bottom nav with AI stream on top */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <GlobalStream />
              <AttentionSummary onSelectChat={handleAttentionSelect} />
            </div>
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
      </div>


      {/* Floating panels - fixed position on right side */}
      <div className={`fixed top-4 right-4 bottom-4 flex gap-4 transition-all duration-300 ease-in-out z-20 ${isPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <MessagePanel
          card={isPanelOpen ? selectedCard : null}
          onClose={handleClosePanel}
          onSend={handleSendFromPanel}
          onSaveDraft={handleSaveDraftFromPanel}
          onClearDraft={handleClearDraftFromPanel}
          onMessagesLoaded={handleMessagesLoaded}
          // Auto-open side panel when viewing from contacts list
          defaultSidePanelOpen={selectedListContactId !== null}
          // Contact profile props
          contact={currentContact}
          allContacts={crmContacts}
          tags={crmTags}
          onSaveContact={handleSaveCrmContact}
          onCreateTag={handleCreateCrmTag}
          onAddTag={handleAddCrmTag}
          onRemoveTag={handleRemoveCrmTag}
          onUnlinkPlatform={handleUnlinkPlatform}
          onMerge={handleMergeCrmContacts}
          onLinkPlatform={handleLinkPlatform}
          onAddAttachments={handleAddAttachments}
          onRemoveAttachment={handleRemoveAttachment}
        />
      </div>
    </div>
  );
}
