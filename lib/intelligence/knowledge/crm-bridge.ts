/**
 * CRM Bridge
 * Syncs existing CRM contacts (localStorage) with Intelligence store (IndexedDB)
 */

import { CrmContactProfile } from '@/lib/types';
import { loadCrmContacts } from '@/lib/storage';
import {
  ContactIntelligence,
  createDefaultContactIntelligence,
} from './types';
import { contactStore } from './store';

/**
 * Sync existing CRM contacts to Intelligence store
 * Called on app init and when CRM updates
 */
export async function syncCrmToIntelligence(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  try {
    const crmContacts = loadCrmContacts();
    let synced = 0;

    for (const [id, crm] of Object.entries(crmContacts)) {
      const existing = await contactStore.get(id);

      if (existing) {
        // Merge CRM updates into intelligence (CRM fields override)
        await contactStore.upsert({
          ...existing,
          // CRM display fields
          displayName: crm.displayName,
          avatarUrl: crm.avatarUrl,
          isGroup: crm.isGroup,
          email: crm.email,
          phone: crm.phone,
          company: crm.company,
          role: crm.role,
          platformLinks: crm.platformLinks,
          tags: crm.tags,
          attachments: crm.attachments,
          // Preserve intelligence fields
          facts: existing.facts,
          relationship: existing.relationship,
          styleProfiles: existing.styleProfiles,
          actionItems: existing.actionItems,
          summary: existing.summary,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new intelligence record from CRM
        await contactStore.upsert(createDefaultContactIntelligence(crm));
      }
      synced++;
    }

    return synced;
  } catch (e) {
    console.error('Failed to sync CRM to intelligence:', e);
    return 0;
  }
}

/**
 * Get enriched contact (CRM + Intelligence)
 */
export async function getEnrichedContact(
  chatId: string
): Promise<ContactIntelligence | null> {
  if (typeof window === 'undefined') return null;

  try {
    const contact = await contactStore.getByChatId(chatId);
    return contact || null;
  } catch {
    return null;
  }
}

/**
 * Get contact by ID
 */
export async function getContactById(
  contactId: string
): Promise<ContactIntelligence | null> {
  if (typeof window === 'undefined') return null;

  try {
    const contact = await contactStore.get(contactId);
    return contact || null;
  } catch {
    return null;
  }
}

/**
 * Create or update contact from a chat interaction
 */
export async function ensureContactForChat(
  chatId: string,
  displayName: string,
  platform: string,
  accountId: string,
  avatarUrl?: string,
  isGroup?: boolean
): Promise<ContactIntelligence> {
  // Check if contact already exists for this chat
  let contact = await contactStore.getByChatId(chatId);

  if (contact) {
    // Update last interaction
    await contactStore.upsert({
      ...contact,
      lastInteractionAt: new Date().toISOString(),
    });
    return contact;
  }

  // Create new contact
  const now = new Date().toISOString();
  const newContact: ContactIntelligence = {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    displayName,
    avatarUrl,
    isGroup,
    platformLinks: [
      {
        platform,
        chatId,
        accountId,
        displayName,
        avatarUrl,
        addedAt: now,
      },
    ],
    tags: [],
    createdAt: now,
    updatedAt: now,
    lastInteractionAt: now,
    facts: [],
    relationship: {
      type: 'unknown',
      confidence: 0,
      evolution: [],
      lastUpdated: now,
    },
    styleProfiles: {},
    actionItems: [],
  };

  await contactStore.upsert(newContact);
  return newContact;
}

/**
 * Add a fact to a contact
 */
export async function addFactToContact(
  contactId: string,
  fact: ContactIntelligence['facts'][0]
): Promise<void> {
  const contact = await contactStore.get(contactId);
  if (!contact) return;

  // Check for duplicate or superseding facts
  const existingIndex = contact.facts.findIndex(
    f => f.category === fact.category && f.content === fact.content
  );

  if (existingIndex >= 0) {
    // Update existing fact's lastConfirmed
    contact.facts[existingIndex].lastConfirmed = new Date().toISOString();
  } else {
    // Add new fact
    contact.facts.push(fact);
  }

  await contactStore.upsert(contact);
}

/**
 * Add an action item to a contact
 */
export async function addActionItemToContact(
  contactId: string,
  actionItem: ContactIntelligence['actionItems'][0]
): Promise<void> {
  const contact = await contactStore.get(contactId);
  if (!contact) return;

  contact.actionItems.push(actionItem);
  await contactStore.upsert(contact);
}

/**
 * Update contact's relationship classification
 */
export async function updateContactRelationship(
  contactId: string,
  relationship: ContactIntelligence['relationship']
): Promise<void> {
  const contact = await contactStore.get(contactId);
  if (!contact) return;

  contact.relationship = relationship;
  await contactStore.upsert(contact);
}

/**
 * Get all contacts with facts
 */
export async function getContactsWithFacts(): Promise<ContactIntelligence[]> {
  const all = await contactStore.getAll();
  return all.filter(c => c.facts && c.facts.length > 0);
}

/**
 * Search contacts by query
 */
export async function searchContacts(
  query: string
): Promise<ContactIntelligence[]> {
  const all = await contactStore.getAll();
  const lowerQuery = query.toLowerCase();

  return all.filter(contact => {
    const matchesName = contact.displayName?.toLowerCase().includes(lowerQuery);
    const matchesFact = contact.facts?.some(f =>
      f.content.toLowerCase().includes(lowerQuery)
    );
    const matchesCompany = contact.company?.toLowerCase().includes(lowerQuery);

    return matchesName || matchesFact || matchesCompany;
  });
}
