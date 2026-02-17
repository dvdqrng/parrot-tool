'use client';

import { useState, useEffect, useCallback } from 'react';
import { CrmContactProfile, CrmTag } from '@/lib/types';
import {
  loadCrmContacts,
  loadCrmTags,
  getCrmContactByChatId,
  createCrmContact,
  updateCrmContact as updateCrmContactStorage,
  deleteCrmContact as deleteCrmContactStorage,
  addPlatformLinkToContact,
  removePlatformLinkFromContact,
  mergeCrmContacts as mergeCrmContactsStorage,
  createCrmTag as createCrmTagStorage,
  deleteCrmTag as deleteCrmTagStorage,
  searchCrmContacts,
  updateContactInteractionStats,
} from '@/lib/storage';

// Get initial data synchronously to avoid flash of empty state
function getInitialContacts(): Record<string, CrmContactProfile> {
  if (typeof window === 'undefined') return {};
  return loadCrmContacts();
}

function getInitialTags(): Record<string, CrmTag> {
  if (typeof window === 'undefined') return {};
  return loadCrmTags();
}

export function useCrm() {
  const [contacts, setContacts] = useState<Record<string, CrmContactProfile>>(getInitialContacts);
  const [tags, setTags] = useState<Record<string, CrmTag>>(getInitialTags);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reload data on mount
  useEffect(() => {
    setContacts(loadCrmContacts());
    setTags(loadCrmTags());
    setIsLoaded(true);
  }, []);

  // Refresh data from storage
  const refresh = useCallback(() => {
    setContacts(loadCrmContacts());
    setTags(loadCrmTags());
  }, []);

  // Get contact by chat ID
  const getContactForChat = useCallback((chatId: string): CrmContactProfile | null => {
    return getCrmContactByChatId(chatId);
  }, []);

  // Update contact with surgical state update
  const updateContact = useCallback((
    contactId: string,
    updates: Partial<CrmContactProfile>
  ): CrmContactProfile | null => {
    const updated = updateCrmContactStorage(contactId, updates);
    if (updated) {
      setContacts(prev => ({ ...prev, [contactId]: updated }));
    }
    return updated;
  }, []);

  // Delete contact with surgical state update
  const deleteContact = useCallback((contactId: string): void => {
    deleteCrmContactStorage(contactId);
    setContacts(prev => {
      const { [contactId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Link a platform chat to an existing contact
  const linkChatToContact = useCallback((
    contactId: string,
    chatId: string,
    platform: string,
    accountId: string,
    displayName?: string,
    avatarUrl?: string
  ): CrmContactProfile | null => {
    const updated = addPlatformLinkToContact(contactId, chatId, platform, accountId, displayName, avatarUrl);
    if (updated) {
      setContacts(prev => ({ ...prev, [contactId]: updated }));
    }
    return updated;
  }, []);

  // Unlink a platform chat from a contact
  const unlinkChatFromContact = useCallback((
    contactId: string,
    chatId: string
  ): CrmContactProfile | null => {
    const updated = removePlatformLinkFromContact(contactId, chatId);
    if (updated) {
      setContacts(prev => ({ ...prev, [contactId]: updated }));
    }
    return updated;
  }, []);

  // Merge two contacts
  const mergeContacts = useCallback((
    targetContactId: string,
    sourceContactId: string
  ): CrmContactProfile | null => {
    const merged = mergeCrmContactsStorage(targetContactId, sourceContactId);
    if (merged) {
      // Update target and remove source in one state update
      setContacts(prev => {
        const { [sourceContactId]: _, ...rest } = prev;
        return { ...rest, [targetContactId]: merged };
      });
    }
    return merged;
  }, []);

  // Tag operations
  const createTag = useCallback((name: string, color?: string): CrmTag => {
    const tag = createCrmTagStorage(name, color);
    setTags(prev => ({ ...prev, [tag.id]: tag }));
    return tag;
  }, []);

  const deleteTag = useCallback((tagId: string): void => {
    deleteCrmTagStorage(tagId);
    setTags(prev => {
      const { [tagId]: _, ...rest } = prev;
      return rest;
    });
    // Contacts are updated in storage by deleteCrmTagStorage, reload to sync
    setContacts(loadCrmContacts());
  }, []);

  // Add tag to contact
  const addTagToContact = useCallback((contactId: string, tagId: string): CrmContactProfile | null => {
    const contact = contacts[contactId];
    if (!contact) return null;
    if (contact.tags.includes(tagId)) return contact;

    return updateContact(contactId, {
      tags: [...contact.tags, tagId]
    });
  }, [contacts, updateContact]);

  // Remove tag from contact
  const removeTagFromContact = useCallback((contactId: string, tagId: string): CrmContactProfile | null => {
    const contact = contacts[contactId];
    if (!contact) return null;

    return updateContact(contactId, {
      tags: contact.tags.filter(t => t !== tagId)
    });
  }, [contacts, updateContact]);

  // Search contacts
  const search = useCallback((query: string): CrmContactProfile[] => {
    return searchCrmContacts(query);
  }, []);

  // Get or create contact for a chat
  const getOrCreateContactForChat = useCallback((
    chatId: string,
    displayName: string,
    platform: string,
    accountId: string,
    avatarUrl?: string,
    isGroup?: boolean
  ): CrmContactProfile => {
    const existing = getCrmContactByChatId(chatId);
    if (existing) return existing;

    const contact = createCrmContact(displayName, chatId, platform, accountId, avatarUrl, isGroup);
    setContacts(prev => ({ ...prev, [contact.id]: contact }));
    return contact;
  }, []);

  // Update interaction stats for a contact
  const updateInteractionStats = useCallback((
    contactId: string,
    messages: Array<{ timestamp: string; isFromMe: boolean }>
  ): CrmContactProfile | null => {
    const updated = updateContactInteractionStats(contactId, messages);
    if (updated) {
      setContacts(prev => ({ ...prev, [contactId]: updated }));
    }
    return updated;
  }, []);

  return {
    // Data
    contacts,
    tags,
    isLoaded,

    // Contact operations
    getContactForChat,
    updateContact,
    deleteContact,
    linkChatToContact,
    unlinkChatFromContact,
    mergeContacts,
    getOrCreateContactForChat,
    updateInteractionStats,

    // Tag operations
    createTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,

    // Search
    search,

    // Refresh
    refresh,
  };
}
