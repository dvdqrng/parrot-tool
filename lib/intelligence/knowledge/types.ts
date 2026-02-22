/**
 * Knowledge Store Type Definitions
 * Core types for contact intelligence, facts, and relationships
 */

import { CrmContactProfile } from '@/lib/types';

// ============================================
// FACT TYPES
// ============================================

export type FactCategory =
  | 'location'
  | 'occupation'
  | 'relationship'
  | 'preference'
  | 'plan'
  | 'contact_info'
  | 'personal'
  | 'professional'
  | 'interest'
  | 'event'
  | 'other';

export interface FactSource {
  messageId: string;
  chatId: string;
  platform: string;
  timestamp: string;
  extractedAt: string;
  tier: 1 | 2 | 3;
}

export interface ContactFact {
  id: string;
  category: FactCategory;
  content: string;
  confidence: number; // 0-1
  source: FactSource;
  firstSeen: string;
  lastConfirmed: string;
  supersededBy?: string; // ID of fact that replaced this
  isActive: boolean;
  sourceContext?: string; // Original message context for display
  extractedAt?: string; // Convenience alias for source.extractedAt
  userVerified?: boolean; // Manually verified by user — survives re-extraction
  userEdited?: boolean; // Content was manually edited by user
}

// Alias for backward compatibility
export type ExtractedFact = ContactFact;

// ============================================
// RELATIONSHIP TYPES
// ============================================

export type RelationshipType =
  | 'close_friend'
  | 'friend'
  | 'acquaintance'
  | 'professional'
  | 'family'
  | 'romantic'
  | 'service_provider'
  | 'unknown';

export interface RelationshipEvent {
  type: 'detected' | 'upgraded' | 'downgraded' | 'confirmed';
  from?: RelationshipType;
  to: RelationshipType;
  confidence: number;
  timestamp: string;
  reason?: string;
}

export interface RelationshipClassification {
  type: RelationshipType;
  confidence: number;
  evolution: RelationshipEvent[];
  lastUpdated: string;
}

// ============================================
// ACTION ITEMS
// ============================================

export type CommitmentStrength = 'firm' | 'soft' | 'social_pleasantry';

export interface ActionItem {
  id: string;
  content: string;
  commitment: CommitmentStrength;
  dueDate?: string;
  status: 'pending' | 'completed' | 'expired' | 'dismissed';
  source: FactSource;
  createdAt: string;
  completedAt?: string;
}

// ============================================
// CONTACT INTELLIGENCE
// ============================================

export interface ContactIntelligence extends CrmContactProfile {
  // Facts with provenance
  facts: ContactFact[];

  // Relationship classification
  relationship: RelationshipClassification;

  // Platform-specific style profiles (platform -> StyleFingerprint)
  styleProfiles: Record<string, StyleFingerprint>;

  // Action items
  actionItems: ActionItem[];

  // AI-generated summary
  summary?: string;
  summaryGeneratedAt?: string;

  // Extraction metadata
  lastExtractionAt?: string;
  extractionVersion?: number;
}

// ============================================
// STYLE TYPES (inline here for simplicity)
// ============================================

export interface StyleFingerprint {
  // Length patterns
  avgMessageLength: number;
  messageBreaking: 'single_long' | 'multiple_short' | 'mixed';

  // Formatting
  capitalization: 'proper' | 'all_lower' | 'all_caps' | 'mixed';
  punctuation: 'full' | 'minimal' | 'none';
  emojiUsage: 'heavy' | 'moderate' | 'light' | 'none';

  // Tone
  formality: 'formal' | 'casual' | 'very_casual';

  // Platform-specific
  platform: string;

  // Confidence
  sampleSize: number;
  confidence: number;

  // Exemplar messages
  exemplarIds: string[];

  // Last updated
  lastUpdated: string;
}

// ============================================
// EXTRACTION QUEUE
// ============================================

export interface ExtractionQueueItem {
  id: string;
  chatId: string;
  contactId: string;
  messageIds: string[];
  priority: 'high' | 'normal' | 'low';
  scheduledFor: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

// ============================================
// DEFAULT CONTACT INTELLIGENCE
// ============================================

export function createDefaultContactIntelligence(
  crm: CrmContactProfile
): ContactIntelligence {
  return {
    ...crm,
    facts: [],
    relationship: {
      type: 'unknown',
      confidence: 0,
      evolution: [],
      lastUpdated: new Date().toISOString(),
    },
    styleProfiles: {},
    actionItems: [],
  };
}
