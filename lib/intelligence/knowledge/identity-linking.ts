/**
 * Identity Linking
 * Links the same person across different platforms/chat IDs
 * Enables unified contact profiles across WhatsApp, Telegram, etc.
 */

import { ContactIntelligence, ContactFact } from './types';
import { contactStore } from './store';

// ============================================
// TYPES
// ============================================

export interface IdentityLink {
  /** The primary contact ID (canonical) */
  primaryId: string;
  /** Secondary contact IDs that link to primary */
  linkedIds: string[];
  /** Confidence in the link */
  confidence: number;
  /** How the link was established */
  linkType: LinkType;
  /** Evidence for the link */
  evidence: LinkEvidence[];
  /** When the link was created */
  createdAt: string;
  /** When the link was last confirmed */
  lastConfirmed: string;
}

export type LinkType =
  | 'user_merged'       // User explicitly merged contacts
  | 'shared_phone'      // Same phone number found
  | 'shared_email'      // Same email address found
  | 'cross_reference'   // Mentioned each other's platforms
  | 'name_match'        // Same or very similar name
  | 'inferred';         // AI-inferred from context

export interface LinkEvidence {
  type: LinkType;
  value: string;
  sourceContact: string;
  foundAt: string;
}

export interface LinkCandidate {
  contact1: ContactIntelligence;
  contact2: ContactIntelligence;
  confidence: number;
  evidence: LinkEvidence[];
}

// ============================================
// EVIDENCE EXTRACTION
// ============================================

/**
 * Extract linkable identifiers from a contact
 */
function extractIdentifiers(contact: ContactIntelligence): {
  phones: string[];
  emails: string[];
  names: string[];
  socialHandles: string[];
} {
  const phones: string[] = [];
  const emails: string[] = [];
  const names: string[] = [];
  const socialHandles: string[] = [];

  // From contact profile
  if (contact.email) emails.push(normalizeEmail(contact.email));
  if (contact.displayName) names.push(normalizeName(contact.displayName));

  // From facts
  for (const fact of contact.facts || []) {
    if (fact.category === 'contact_info') {
      const content = fact.content;

      // Phone extraction
      const phoneMatch = content.match(/(\+?1?\s*[-.(]?\d{3}[-.)]\s*\d{3}[-.]?\d{4})/);
      if (phoneMatch) phones.push(normalizePhone(phoneMatch[1]));

      // Email extraction
      const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) emails.push(normalizeEmail(emailMatch[1]));

      // Social handle extraction
      const handleMatch = content.match(/@([a-zA-Z0-9_]{1,30})/);
      if (handleMatch) socialHandles.push(handleMatch[1].toLowerCase());
    }
  }

  return {
    phones: [...new Set(phones)],
    emails: [...new Set(emails)],
    names: [...new Set(names)],
    socialHandles: [...new Set(socialHandles)],
  };
}

function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Normalize to last 10 digits (US format)
  return digits.slice(-10);
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================
// CANDIDATE DETECTION
// ============================================

/**
 * Find potential identity links between contacts
 */
export async function findLinkCandidates(): Promise<LinkCandidate[]> {
  const contacts = await contactStore.getAll();
  const candidates: LinkCandidate[] = [];

  // Extract identifiers for all contacts
  const contactIdentifiers = new Map<string, ReturnType<typeof extractIdentifiers>>();
  for (const contact of contacts) {
    contactIdentifiers.set(contact.id, extractIdentifiers(contact));
  }

  // Compare all pairs
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const contact1 = contacts[i];
      const contact2 = contacts[j];

      // Skip if already on same platform link
      const sharedPlatform = contact1.platformLinks?.some(l1 =>
        contact2.platformLinks?.some(l2 => l1.chatId === l2.chatId)
      );
      if (sharedPlatform) continue;

      const id1 = contactIdentifiers.get(contact1.id)!;
      const id2 = contactIdentifiers.get(contact2.id)!;

      const evidence: LinkEvidence[] = [];
      let confidence = 0;
      const now = new Date().toISOString();

      // Check phone matches (strongest signal)
      for (const phone of id1.phones) {
        if (id2.phones.includes(phone)) {
          evidence.push({
            type: 'shared_phone',
            value: phone,
            sourceContact: contact1.id,
            foundAt: now,
          });
          confidence += 0.5;
        }
      }

      // Check email matches (strong signal)
      for (const email of id1.emails) {
        if (id2.emails.includes(email)) {
          evidence.push({
            type: 'shared_email',
            value: email,
            sourceContact: contact1.id,
            foundAt: now,
          });
          confidence += 0.4;
        }
      }

      // Check name matches (moderate signal)
      for (const name1 of id1.names) {
        for (const name2 of id2.names) {
          const similarity = calculateNameSimilarity(name1, name2);
          if (similarity > 0.8) {
            evidence.push({
              type: 'name_match',
              value: `${name1} ≈ ${name2}`,
              sourceContact: contact1.id,
              foundAt: now,
            });
            confidence += 0.2 * similarity;
          }
        }
      }

      // Check social handle matches
      for (const handle of id1.socialHandles) {
        if (id2.socialHandles.includes(handle)) {
          evidence.push({
            type: 'cross_reference',
            value: `@${handle}`,
            sourceContact: contact1.id,
            foundAt: now,
          });
          confidence += 0.3;
        }
      }

      // If we found evidence, add as candidate
      if (evidence.length > 0 && confidence > 0.2) {
        candidates.push({
          contact1,
          contact2,
          confidence: Math.min(0.95, confidence),
          evidence,
        });
      }
    }
  }

  // Sort by confidence
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate name similarity using multiple methods
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  if (name1 === name2) return 1;

  const parts1 = name1.split(' ');
  const parts2 = name2.split(' ');

  // Check if one contains the other
  if (name1.includes(name2) || name2.includes(name1)) {
    return 0.9;
  }

  // Check first name match
  if (parts1[0] === parts2[0] && parts1[0].length > 2) {
    return 0.7;
  }

  // Check last name match
  if (parts1.length > 1 && parts2.length > 1) {
    if (parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
      return 0.6;
    }
  }

  // Levenshtein-based similarity
  const distance = levenshteinDistance(name1, name2);
  const maxLen = Math.max(name1.length, name2.length);
  const similarity = 1 - distance / maxLen;

  return similarity;
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// ============================================
// LINK CREATION & MERGING
// ============================================

/**
 * Create a link between two contacts
 */
export async function createLink(
  primaryId: string,
  secondaryId: string,
  linkType: LinkType,
  evidence: LinkEvidence[]
): Promise<IdentityLink> {
  const now = new Date().toISOString();

  const link: IdentityLink = {
    primaryId,
    linkedIds: [secondaryId],
    confidence: Math.min(
      0.95,
      evidence.reduce((sum, e) => {
        switch (e.type) {
          case 'user_merged': return sum + 1;
          case 'shared_phone': return sum + 0.5;
          case 'shared_email': return sum + 0.4;
          case 'cross_reference': return sum + 0.3;
          case 'name_match': return sum + 0.2;
          case 'inferred': return sum + 0.1;
          default: return sum;
        }
      }, 0)
    ),
    linkType,
    evidence,
    createdAt: now,
    lastConfirmed: now,
  };

  return link;
}

/**
 * Merge two contacts into one, combining their intelligence
 */
export async function mergeContacts(
  primaryId: string,
  secondaryId: string
): Promise<ContactIntelligence | null> {
  const primary = await contactStore.get(primaryId);
  const secondary = await contactStore.get(secondaryId);

  if (!primary || !secondary) return null;

  // Merge platform links
  const mergedPlatformLinks = [
    ...(primary.platformLinks || []),
    ...(secondary.platformLinks || []),
  ].filter(
    (link, index, self) =>
      index === self.findIndex(l => l.chatId === link.chatId)
  );

  // Merge facts (using deduplication)
  const allFacts = [...(primary.facts || []), ...(secondary.facts || [])];

  // Merge action items
  const allActionItems = [
    ...(primary.actionItems || []),
    ...(secondary.actionItems || []),
  ].filter(
    (item, index, self) =>
      index === self.findIndex(i => i.content === item.content)
  );

  // Merge style profiles
  const mergedStyleProfiles = {
    ...(secondary.styleProfiles || {}),
    ...(primary.styleProfiles || {}), // Primary takes precedence
  };

  // Use primary's relationship classification, but update if secondary is more confident
  let relationship = primary.relationship;
  if (
    secondary.relationship &&
    secondary.relationship.confidence > (primary.relationship?.confidence || 0)
  ) {
    relationship = secondary.relationship;
  }

  // Create merged contact
  const merged: ContactIntelligence = {
    ...primary,
    platformLinks: mergedPlatformLinks,
    facts: allFacts,
    actionItems: allActionItems,
    styleProfiles: mergedStyleProfiles,
    relationship: relationship,
    updatedAt: new Date().toISOString(),
  };

  // Save merged contact
  await contactStore.upsert(merged);

  // Delete secondary contact
  await contactStore.delete(secondaryId);

  return merged;
}

// ============================================
// CROSS-REFERENCE DETECTION
// ============================================

/**
 * Detect when someone mentions their other platform in a message
 * e.g., "My WhatsApp is +1234567890" in a Telegram chat
 */
export function detectCrossReference(
  messageText: string,
  currentPlatform: string
): { platform: string; identifier: string } | null {
  const platformPatterns: Record<string, RegExp[]> = {
    whatsapp: [
      /(?:whatsapp|wa)(?:\s+(?:me|number|at))?\s*[:@]?\s*(\+?[\d\s-]+)/i,
      /(?:my|on)\s+(?:whatsapp|wa)\s+(?:is)?\s*[:@]?\s*(\+?[\d\s-]+)/i,
    ],
    telegram: [
      /(?:telegram|tg)(?:\s+(?:me|at))?\s*[:@]?\s*@?(\w+)/i,
      /(?:my|on)\s+(?:telegram|tg)\s+(?:is)?\s*[:@]?\s*@?(\w+)/i,
    ],
    instagram: [
      /(?:instagram|ig|insta)(?:\s+(?:me|at))?\s*[:@]?\s*@?(\w+)/i,
      /(?:my|on)\s+(?:instagram|ig|insta)\s+(?:is)?\s*[:@]?\s*@?(\w+)/i,
    ],
    twitter: [
      /(?:twitter|x)(?:\s+(?:me|at))?\s*[:@]?\s*@?(\w+)/i,
      /(?:my|on)\s+(?:twitter|x)\s+(?:is)?\s*[:@]?\s*@?(\w+)/i,
    ],
    signal: [
      /(?:signal)(?:\s+(?:me|number|at))?\s*[:@]?\s*(\+?[\d\s-]+)/i,
    ],
    discord: [
      /(?:discord)(?:\s+(?:me|at))?\s*[:@]?\s*(\w+#\d+|\w+)/i,
    ],
  };

  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    // Skip if it's the current platform
    if (platform === currentPlatform.toLowerCase()) continue;

    for (const pattern of patterns) {
      const match = messageText.match(pattern);
      if (match && match[1]) {
        return {
          platform,
          identifier: match[1].trim(),
        };
      }
    }
  }

  return null;
}

// ============================================
// AUTOMATIC LINKING
// ============================================

/**
 * Automatically link contacts based on high-confidence matches
 * Returns the links that were created
 */
export async function autoLinkContacts(
  minConfidence: number = 0.7
): Promise<IdentityLink[]> {
  const candidates = await findLinkCandidates();
  const links: IdentityLink[] = [];

  // Only auto-link high confidence matches
  const highConfidence = candidates.filter(c => c.confidence >= minConfidence);

  for (const candidate of highConfidence) {
    // Skip if either contact is already linked
    // (would need to check against existing links)

    const link = await createLink(
      candidate.contact1.id,
      candidate.contact2.id,
      candidate.evidence[0]?.type || 'inferred',
      candidate.evidence
    );

    links.push(link);
  }

  return links;
}
