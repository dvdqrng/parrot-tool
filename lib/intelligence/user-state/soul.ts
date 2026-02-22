/**
 * Soul / Identity Layer
 * User-defined personality and communication preferences
 * Injected into every LLM call as the base identity context
 */

// ============================================
// TYPES
// ============================================

export type SoulTraitCategory =
  | 'personality'
  | 'communication_style'
  | 'value'
  | 'background'
  | 'habit'
  | 'preference'
  | 'identity';

export interface SoulTrait {
  id: string;
  category: SoulTraitCategory;
  content: string;           // "Uses lowercase in casual chats"
  confidence: number;        // 0-1
  evidence: string[];        // Sample message snippets that support this
  extractedAt: string;
  userVerified?: boolean;    // Pinned by user — survives re-extraction
  userEdited?: boolean;      // Content manually modified
  isActive: boolean;
}

export interface UserSoul {
  id: string; // always 'soul'

  // Core identity (manual overrides)
  name: string;
  bio: string; // free-text: "I'm a startup founder, parent of two..."

  // Communication preferences (user-defined, not inferred)
  toneKeywords: string[]; // ["sarcastic", "warm", "direct"]
  neverDo: string[]; // ["use exclamation marks", "say 'no worries'"]
  alwaysDo: string[]; // ["use lowercase", "include context when replying late"]

  // Relationship defaults
  defaultFormality: 'formal' | 'casual' | 'match_them' | 'unset';

  // Free-text system instruction (power users)
  customSystemPrompt: string; // "When drafting for me, always..."

  // Auto-extracted identity traits from sent messages
  extractedTraits: SoulTrait[];
  lastExtractionAt?: string;

  updatedAt: string;
}

// ============================================
// DEFAULT
// ============================================

export function createDefaultSoul(): UserSoul {
  return {
    id: 'soul',
    name: '',
    bio: '',
    toneKeywords: [],
    neverDo: [],
    alwaysDo: [],
    defaultFormality: 'unset',
    customSystemPrompt: '',
    extractedTraits: [],
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// PROMPT RENDERING
// ============================================

/**
 * Render the soul into a system prompt block.
 * Returns empty string if the soul is unconfigured (no name or bio).
 */
const TRAIT_CATEGORY_LABELS: Record<SoulTraitCategory, string> = {
  personality: 'Personality',
  communication_style: 'Communication Style',
  value: 'Values',
  background: 'Background',
  habit: 'Habits',
  preference: 'Preferences',
  identity: 'Identity',
};

export function renderSoulBlock(soul: UserSoul | null | undefined): string {
  if (!soul) return '';

  const hasIdentity = soul.name || soul.bio;
  const hasPreferences =
    soul.toneKeywords.length > 0 ||
    soul.neverDo.length > 0 ||
    soul.alwaysDo.length > 0 ||
    soul.defaultFormality !== 'unset';
  const hasCustomPrompt = soul.customSystemPrompt.trim().length > 0;
  const activeTraits = (soul.extractedTraits || []).filter(t => t.isActive);
  const hasTraits = activeTraits.length > 0;

  if (!hasIdentity && !hasPreferences && !hasCustomPrompt && !hasTraits) return '';

  const parts: string[] = ['## About the User'];

  if (soul.name) {
    parts.push(`Name: ${soul.name}`);
  }

  if (soul.bio) {
    parts.push(soul.bio);
  }

  if (soul.toneKeywords.length > 0) {
    parts.push(`Communication style: ${soul.toneKeywords.join(', ')}`);
  }

  if (soul.defaultFormality !== 'unset') {
    const formalityMap = {
      formal: 'Prefers formal communication',
      casual: 'Prefers casual communication',
      match_them: 'Mirrors the other person\'s formality level',
    };
    parts.push(formalityMap[soul.defaultFormality]);
  }

  if (soul.alwaysDo.length > 0) {
    parts.push('');
    parts.push('When writing as this user, ALWAYS:');
    for (const rule of soul.alwaysDo) {
      parts.push(`- ${rule}`);
    }
  }

  if (soul.neverDo.length > 0) {
    parts.push('');
    parts.push('When writing as this user, NEVER:');
    for (const rule of soul.neverDo) {
      parts.push(`- ${rule}`);
    }
  }

  // Render auto-extracted traits grouped by category
  if (hasTraits) {
    parts.push('');
    parts.push('### Observed Traits (extracted from messaging history)');

    // Group by category
    const grouped = new Map<SoulTraitCategory, SoulTrait[]>();
    for (const trait of activeTraits) {
      const list = grouped.get(trait.category) || [];
      list.push(trait);
      grouped.set(trait.category, list);
    }

    // Render each category, sorted by confidence within group
    for (const [category, traits] of grouped) {
      const label = TRAIT_CATEGORY_LABELS[category] || category;
      parts.push(`**${label}**:`);
      const sorted = [...traits].sort((a, b) => b.confidence - a.confidence);
      for (const trait of sorted) {
        parts.push(`- ${trait.content}`);
      }
    }
  }

  if (hasCustomPrompt) {
    parts.push('');
    parts.push('Additional instructions:');
    parts.push(soul.customSystemPrompt);
  }

  return parts.join('\n');
}

/**
 * Check if the soul has meaningful content configured
 */
export function isSoulConfigured(soul: UserSoul | null | undefined): boolean {
  if (!soul) return false;
  return !!(
    soul.name ||
    soul.bio ||
    soul.toneKeywords.length > 0 ||
    soul.neverDo.length > 0 ||
    soul.alwaysDo.length > 0 ||
    soul.customSystemPrompt.trim() ||
    (soul.extractedTraits && soul.extractedTraits.filter(t => t.isActive).length > 0)
  );
}
