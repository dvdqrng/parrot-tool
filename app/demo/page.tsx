'use client';

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import { MessageBoard } from '@/components/kanban/message-board';
import { MessagePanel } from '@/components/message-panel';
import { BottomNavigation, MainView } from '@/components/dashboard/bottom-navigation';
import { KanbanCard, Draft, KanbanGroupBy } from '@/lib/types';
import {
  demoUnreadMessages,
  demoDrafts,
  demoSentMessages,
  demoAvatars,
  demoChatInfo,
  demoContacts,
  demoTags,
} from './demo-data';

export default function DemoPage() {
  return (
    <Suspense>
      <DemoPageInner />
    </Suspense>
  );
}

function DemoPageInner() {
  const { setTheme } = useTheme();
  const searchParams = useSearchParams();

  // Force light theme for consistent screenshots
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  // URL params for controlling the view:
  //   ?view=platform   → show platform columns
  //   ?open=msg-4      → auto-select a card by message ID
  const initialGroupBy = (searchParams.get('view') as KanbanGroupBy) || 'status';
  const autoOpenId = searchParams.get('open');

  // UI state
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [groupBy, setGroupBy] = useState<KanbanGroupBy>(initialGroupBy);
  const [currentView, setCurrentView] = useState<MainView>('kanban');
  const [drafts, setDrafts] = useState<Draft[]>(demoDrafts);

  // Filter out messages that have drafts (same as main app logic)
  const draftChatIds = useMemo(() => new Set(drafts.map(d => d.chatId)), [drafts]);

  const filteredUnreadMessages = useMemo(
    () => demoUnreadMessages.filter(m => !draftChatIds.has(m.chatId)),
    [draftChatIds]
  );

  const filteredSentMessages = useMemo(
    () => demoSentMessages.filter(m => !draftChatIds.has(m.chatId)),
    [draftChatIds]
  );

  // Card click handler
  const handleCardClick = useCallback((card: KanbanCard) => {
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }, []);

  // Auto-open a card based on URL param (for screenshot setup)
  useEffect(() => {
    if (!autoOpenId) return;

    // Find in unread messages
    const msg = demoUnreadMessages.find(m => m.id === autoOpenId);
    if (msg) {
      const card: KanbanCard = {
        id: msg.id,
        type: 'message',
        message: msg,
        title: msg.senderName,
        preview: msg.text,
        timestamp: msg.timestamp,
        platform: msg.platform || 'unknown',
        avatarUrl: demoAvatars[msg.chatId],
        unreadCount: msg.unreadCount,
        isGroup: msg.isGroup,
      };
      setSelectedCard(card);
      return;
    }

    // Find in drafts
    const draft = demoDrafts.find(d => d.id === autoOpenId);
    if (draft) {
      const card: KanbanCard = {
        id: draft.id,
        type: 'draft',
        draft,
        title: draft.recipientName,
        preview: draft.draftText,
        timestamp: draft.updatedAt,
        platform: draft.platform,
        avatarUrl: draft.avatarUrl,
        isGroup: draft.isGroup,
      };
      setSelectedCard(card);
    }
  }, [autoOpenId]);

  // Get current contact for the selected card
  const currentChatId = selectedCard?.message?.chatId || selectedCard?.draft?.chatId || null;
  const currentContact = currentChatId
    ? Object.values(demoContacts).find(c =>
        c.platformLinks.some(link => link.chatId === currentChatId)
      ) || null
    : null;

  // No-op handlers for demo mode
  const handleSend = useCallback(async () => {
    await new Promise(r => setTimeout(r, 500));
  }, []);

  const handleSaveDraft = useCallback((text: string) => {
    if (!selectedCard) return;
    const chatId = selectedCard.message?.chatId || selectedCard.draft?.chatId;
    if (!chatId) return;

    setDrafts(prev => {
      const existing = prev.find(d => d.chatId === chatId);
      if (existing) {
        return prev.map(d => d.chatId === chatId ? { ...d, draftText: text, updatedAt: new Date().toISOString() } : d);
      }
      return prev;
    });
  }, [selectedCard]);

  const handleClearDraft = useCallback(() => {
    if (!selectedCard) return;
    const chatId = selectedCard.message?.chatId || selectedCard.draft?.chatId;
    if (!chatId) return;
    setDrafts(prev => prev.filter(d => d.chatId !== chatId));
  }, [selectedCard]);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const handleDeleteDraft = useCallback((card: KanbanCard) => {
    if (card.draft) {
      setDrafts(prev => prev.filter(d => d.id !== card.draft!.id));
    }
  }, []);

  const isPanelOpen = selectedCard !== null;

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden pt-10 pl-6">
          {currentView === 'kanban' ? (
            <div className="h-full overflow-x-auto">
              <MessageBoard
                groupBy={groupBy}
                unreadMessages={filteredUnreadMessages}
                drafts={drafts}
                sentMessages={filteredSentMessages}
                avatars={demoAvatars}
                chatInfo={demoChatInfo}
                onCardClick={handleCardClick}
                onArchive={() => {}}
                onUnarchive={() => {}}
                onHide={() => {}}
                onDeleteDraft={handleDeleteDraft}
                hasMore={false}
                isLoadingMore={false}
                onLoadMore={() => {}}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Contacts view (demo)
            </div>
          )}
        </main>

        {/* Floating bottom bar */}
        <div className="fixed bottom-6 left-[320px] -translate-x-1/2 z-10 flex flex-col items-center">
          <div className="flex flex-col items-center gap-2">
            <BottomNavigation
              onNewContact={() => {}}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              currentView={currentView}
              onViewChange={setCurrentView}
              onFilterClick={() => {}}
              onGroupByClick={() => {}}
              hasActiveFilters={false}
            />
          </div>
        </div>
      </div>

      {/* Floating message panel */}
      <div className={`fixed top-4 right-4 bottom-4 flex gap-4 transition-all duration-300 ease-in-out z-20 ${isPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <MessagePanel
          card={isPanelOpen ? selectedCard : null}
          onClose={handleClosePanel}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
          onClearDraft={handleClearDraft}
          contact={currentContact}
          allContacts={demoContacts}
          tags={demoTags}
          onSaveContact={() => {}}
          onCreateTag={(name: string) => ({ id: `tag-${Date.now()}`, name, color: '#888', createdAt: new Date().toISOString() })}
          onAddTag={() => {}}
          onRemoveTag={() => {}}
          onUnlinkPlatform={() => {}}
          onMerge={() => {}}
          onLinkPlatform={() => {}}
        />
      </div>
    </div>
  );
}
