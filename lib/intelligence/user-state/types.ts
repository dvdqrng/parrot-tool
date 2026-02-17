/**
 * User State / User Intelligence Type Definitions
 * What the system knows about YOU - your current state, activities, and patterns
 */

import { RelationshipType } from '../knowledge/types';

// ============================================
// MESSAGE REFERENCE
// ============================================

export interface MessageRef {
  messageId: string;
  chatId: string;
  platform: string;
  timestamp: string;
}

// ============================================
// ACTIVE CONTEXTS
// ============================================

export interface CanonicalFact {
  label: string;
  value: string;
  confidence: number;
}

export interface ActiveContext {
  id: string;
  label: string; // "Birthday party planning", "Fundraising", etc.
  confidence: number; // 0-1
  firstDetected: string;
  lastUpdated: string;
  relatedContacts: string[]; // contactIds who you've discussed this with
  keyFacts: CanonicalFact[]; // The canonical details
  platformDistribution: Record<string, string[]>; // platform -> contactIds
  status: 'active' | 'winding_down' | 'completed';
  autoExpiry?: string; // When to auto-complete
}

// ============================================
// TOPIC CLUSTERS
// ============================================

export interface TopicCluster {
  id: string;
  topic: string;
  keywords: string[];
  frequency: number;
  recency: number; // Weighted score combining frequency and recency
  relatedMessages: MessageRef[];
  firstMentioned: string;
  lastMentioned: string;
}

// ============================================
// DISTRIBUTED INFO
// ============================================

export interface DistributedInfoItem {
  id: string;
  content: string; // The canonical version of the info
  variations: string[]; // Different phrasings you've used
  sharedWith: string[]; // contactIds who have received this
  notYetSharedWith: string[]; // Relevant contactIds who haven't
  firstShared: string;
  lastShared: string;
  sourceMessages: MessageRef[];
}

// ============================================
// CANONICAL EXPLANATIONS
// ============================================

export interface CanonicalExplanation {
  id: string;
  topic: string; // "What my startup does", "Directions to my apartment"
  shortVersion: string; // 1-2 sentence version
  longVersion: string; // Full explanation
  variations: Partial<Record<RelationshipType, string>>; // How you explain to different people
  frequency: number; // How often you've explained this
  lastUsed: string;
}

// ============================================
// COMMUNICATION MODE
// ============================================

export type CommunicationMode =
  | 'high_social'   // Lots of quick messages, organizing events
  | 'heads_down'    // Focused, few messages, longer response times
  | 'mixed'         // Normal patterns
  | 'catching_up';  // Responding to backlog

// ============================================
// PRIORITIES
// ============================================

export interface Priority {
  id: string;
  label: string;
  confidence: number;
  relatedContexts: string[];
}

// ============================================
// SHARED ARTIFACTS
// ============================================

export type ArtifactType = 'url' | 'file' | 'image' | 'location' | 'contact_info';

export interface SharedArtifact {
  id: string;
  type: ArtifactType;
  content: string; // URL, file reference, etc.
  sharedWith: string[]; // contactIds
  sharedOn: string[]; // platforms
  firstShared: string;
  context: string; // Why you're sharing this
}

// ============================================
// USER INTELLIGENCE (Main Type)
// ============================================

export interface UserIntelligence {
  id: string; // Always 'current'

  // What you're currently doing
  activeContexts: ActiveContext[];

  // What you're talking about, ranked
  activeTopics: TopicCluster[];

  // Information you're sharing with people
  distributedInfo: DistributedInfoItem[];

  // Things you explain repeatedly
  canonicalExplanations: CanonicalExplanation[];

  // Your current communication patterns
  communicationMode: CommunicationMode;

  // Current priorities
  currentPriorities: Priority[];

  // Artifacts being shared
  sharedArtifacts: SharedArtifact[];

  // Last updated
  lastUpdated: string;
}

// ============================================
// DEFAULT USER INTELLIGENCE
// ============================================

export function createDefaultUserIntelligence(): UserIntelligence {
  return {
    id: 'current',
    activeContexts: [],
    activeTopics: [],
    distributedInfo: [],
    canonicalExplanations: [],
    communicationMode: 'mixed',
    currentPriorities: [],
    sharedArtifacts: [],
    lastUpdated: new Date().toISOString(),
  };
}
