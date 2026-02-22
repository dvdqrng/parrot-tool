/**
 * Ambient Stream Processor
 * Analyzes the user's sent messages in aggregate to understand their current state
 * This is the v4 differentiator - understanding YOU, not just your contacts
 */

import { BeeperMessage } from '@/lib/types';
import {
  UserIntelligence,
  TopicCluster,
  ActiveContext,
  DistributedInfoItem,
  CommunicationMode,
  SharedArtifact,
  MessageRef,
} from './types';
import { extractTier1 } from '../extraction/tier1-local';

// ============================================
// PROCESSOR CONFIG
// ============================================

export interface AmbientProcessorConfig {
  windowHours: number; // How far back to look (default: 48)
  minMessagesForTopic: number; // Minimum messages to form a topic cluster
  minDistributionCount: number; // Minimum shares to track distributed info
}

const DEFAULT_CONFIG: AmbientProcessorConfig = {
  windowHours: 48,
  minMessagesForTopic: 2,
  minDistributionCount: 2,
};

// ============================================
// MAIN PROCESSOR
// ============================================

const LOG_PREFIX = '[AmbientProcessor]';

export async function processAmbientStream(
  sentMessages: BeeperMessage[],
  config: AmbientProcessorConfig = DEFAULT_CONFIG
): Promise<Partial<UserIntelligence>> {
  console.log(`${LOG_PREFIX} processAmbientStream: ${sentMessages.length} sent messages, window: ${config.windowHours}h`);

  const windowStart = new Date(
    Date.now() - config.windowHours * 60 * 60 * 1000
  );
  const recentMessages = sentMessages.filter(
    m => new Date(m.timestamp) > windowStart && m.isFromMe
  );

  if (recentMessages.length === 0) {
    console.log(`${LOG_PREFIX} No recent messages in window - returning default mode`);
    return {
      communicationMode: 'mixed',
    };
  }

  const uniqueChats = new Set(recentMessages.map(m => m.chatId));
  console.log(`${LOG_PREFIX} Processing ${recentMessages.length} messages across ${uniqueChats.size} chats`);

  // Extract tier 1 data from all messages
  const tier1Results = recentMessages.map(extractTier1);

  // Process in parallel
  const [activeTopics, distributedInfo, sharedArtifacts, communicationMode] =
    await Promise.all([
      clusterTopics(recentMessages, config),
      trackDistribution(recentMessages, config),
      extractSharedArtifacts(recentMessages, tier1Results),
      detectCommunicationMode(recentMessages),
    ]);

  // Infer active contexts from topics and distribution
  const activeContexts = await inferActiveContexts(
    activeTopics,
    distributedInfo,
    recentMessages
  );

  console.log(`${LOG_PREFIX} ✓ Ambient processing complete:`, {
    topics: activeTopics.length,
    topTopics: activeTopics.slice(0, 5).map(t => `${t.topic}(${t.frequency})`),
    distributedInfo: distributedInfo.length,
    sharedArtifacts: sharedArtifacts.length,
    activeContexts: activeContexts.length,
    contextLabels: activeContexts.map(c => c.label),
    communicationMode,
  });

  return {
    activeTopics,
    activeContexts,
    distributedInfo,
    sharedArtifacts,
    communicationMode,
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// TOPIC CLUSTERING
// ============================================

async function clusterTopics(
  messages: BeeperMessage[],
  config: AmbientProcessorConfig
): Promise<TopicCluster[]> {
  // Simple keyword-based clustering
  const wordCounts = new Map<string, { count: number; messages: MessageRef[] }>();

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they',
    'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who',
    'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
    'yeah', 'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank', 'hi',
    'hey', 'hello', 'bye', 'good', 'great', 'nice', 'cool', 'lol',
  ]);

  for (const msg of messages) {
    const text = (msg.text || '').toLowerCase();
    const words = text.split(/\s+/).filter(w =>
      w.length > 3 &&
      !stopWords.has(w) &&
      /^[a-z]+$/.test(w)
    );

    for (const word of words) {
      const existing = wordCounts.get(word) || { count: 0, messages: [] };
      existing.count++;
      existing.messages.push({
        messageId: msg.id,
        chatId: msg.chatId,
        platform: msg.platform || 'unknown',
        timestamp: msg.timestamp,
      });
      wordCounts.set(word, existing);
    }
  }

  // Convert to topic clusters
  const topics: TopicCluster[] = [];
  const now = Date.now();

  for (const [word, data] of wordCounts) {
    if (data.count >= config.minMessagesForTopic) {
      const timestamps = data.messages.map(m => new Date(m.timestamp).getTime());
      const lastMentioned = Math.max(...timestamps);
      const firstMentioned = Math.min(...timestamps);

      // Recency score: higher if more recent
      const recencyScore = (lastMentioned - (now - 48 * 60 * 60 * 1000)) / (48 * 60 * 60 * 1000);

      topics.push({
        id: `topic-${word}-${Date.now()}`,
        topic: word,
        keywords: [word],
        frequency: data.count,
        recency: Math.max(0, recencyScore) * data.count, // Weighted by frequency
        relatedMessages: data.messages,
        firstMentioned: new Date(firstMentioned).toISOString(),
        lastMentioned: new Date(lastMentioned).toISOString(),
      });
    }
  }

  // Sort by recency score
  topics.sort((a, b) => b.recency - a.recency);

  return topics.slice(0, 20); // Top 20 topics
}

// ============================================
// DISTRIBUTION TRACKING
// ============================================

async function trackDistribution(
  messages: BeeperMessage[],
  config: AmbientProcessorConfig
): Promise<DistributedInfoItem[]> {
  // Track phrases/info shared across multiple chats
  const sharedContent = new Map<
    string,
    {
      variations: string[];
      chatIds: Set<string>;
      messages: MessageRef[];
      firstShared: string;
      lastShared: string;
    }
  >();

  // Simple approach: look for similar sentences across chats
  for (const msg of messages) {
    const text = (msg.text || '').trim();
    if (text.length < 20) continue; // Skip very short messages

    // Normalize for comparison
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');

    // Check if similar content exists
    let found = false;
    for (const [key, data] of sharedContent) {
      // Simple similarity: first 50 chars match
      if (normalized.slice(0, 50) === key.slice(0, 50)) {
        data.chatIds.add(msg.chatId);
        data.variations.push(text);
        data.messages.push({
          messageId: msg.id,
          chatId: msg.chatId,
          platform: msg.platform || 'unknown',
          timestamp: msg.timestamp,
        });
        if (msg.timestamp < data.firstShared) data.firstShared = msg.timestamp;
        if (msg.timestamp > data.lastShared) data.lastShared = msg.timestamp;
        found = true;
        break;
      }
    }

    if (!found) {
      sharedContent.set(normalized, {
        variations: [text],
        chatIds: new Set([msg.chatId]),
        messages: [
          {
            messageId: msg.id,
            chatId: msg.chatId,
            platform: msg.platform || 'unknown',
            timestamp: msg.timestamp,
          },
        ],
        firstShared: msg.timestamp,
        lastShared: msg.timestamp,
      });
    }
  }

  // Convert to distributed info items (only if shared across multiple chats)
  const distributedInfo: DistributedInfoItem[] = [];

  for (const [_, data] of sharedContent) {
    if (data.chatIds.size >= config.minDistributionCount) {
      distributedInfo.push({
        id: `dist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        content: data.variations[0], // Canonical version
        variations: [...new Set(data.variations)],
        sharedWith: [...data.chatIds],
        notYetSharedWith: [], // Would need contact list to populate
        firstShared: data.firstShared,
        lastShared: data.lastShared,
        sourceMessages: data.messages,
      });
    }
  }

  return distributedInfo.slice(0, 10); // Top 10
}

// ============================================
// SHARED ARTIFACTS
// ============================================

async function extractSharedArtifacts(
  messages: BeeperMessage[],
  tier1Results: ReturnType<typeof extractTier1>[]
): Promise<SharedArtifact[]> {
  const artifacts = new Map<
    string,
    {
      type: SharedArtifact['type'];
      chatIds: Set<string>;
      platforms: Set<string>;
      firstShared: string;
    }
  >();

  for (let i = 0; i < tier1Results.length; i++) {
    const result = tier1Results[i];
    const msg = messages[i];

    // URLs
    for (const url of result.urls) {
      const existing = artifacts.get(url) || {
        type: 'url' as const,
        chatIds: new Set<string>(),
        platforms: new Set<string>(),
        firstShared: msg.timestamp,
      };
      existing.chatIds.add(msg.chatId);
      existing.platforms.add(msg.platform || 'unknown');
      artifacts.set(url, existing);
    }

    // Phones/contacts
    for (const phone of result.phones) {
      const existing = artifacts.get(phone) || {
        type: 'contact_info' as const,
        chatIds: new Set<string>(),
        platforms: new Set<string>(),
        firstShared: msg.timestamp,
      };
      existing.chatIds.add(msg.chatId);
      existing.platforms.add(msg.platform || 'unknown');
      artifacts.set(phone, existing);
    }
  }

  // Convert to SharedArtifact
  const sharedArtifacts: SharedArtifact[] = [];

  for (const [content, data] of artifacts) {
    if (data.chatIds.size >= 2) {
      // Shared with at least 2 chats
      sharedArtifacts.push({
        id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: data.type,
        content,
        sharedWith: [...data.chatIds],
        sharedOn: [...data.platforms],
        firstShared: data.firstShared,
        context: '', // Would need more analysis
      });
    }
  }

  return sharedArtifacts;
}

// ============================================
// COMMUNICATION MODE DETECTION
// ============================================

async function detectCommunicationMode(
  messages: BeeperMessage[]
): Promise<CommunicationMode> {
  if (messages.length === 0) return 'mixed';

  const now = Date.now();
  const lastHour = messages.filter(
    m => now - new Date(m.timestamp).getTime() < 60 * 60 * 1000
  );
  const lastDay = messages.filter(
    m => now - new Date(m.timestamp).getTime() < 24 * 60 * 60 * 1000
  );

  // High social: many messages in the last hour across multiple chats
  const uniqueChatsLastHour = new Set(lastHour.map(m => m.chatId)).size;
  if (lastHour.length > 10 && uniqueChatsLastHour > 3) {
    return 'high_social';
  }

  // Heads down: few messages, long gaps
  if (lastDay.length < 5) {
    return 'heads_down';
  }

  // Catching up: burst of activity after a quiet period
  const twoHoursAgo = messages.filter(
    m =>
      now - new Date(m.timestamp).getTime() > 2 * 60 * 60 * 1000 &&
      now - new Date(m.timestamp).getTime() < 6 * 60 * 60 * 1000
  );
  if (lastHour.length > 5 && twoHoursAgo.length < 2) {
    return 'catching_up';
  }

  return 'mixed';
}

// ============================================
// CONTEXT INFERENCE
// ============================================

async function inferActiveContexts(
  topics: TopicCluster[],
  distributedInfo: DistributedInfoItem[],
  messages: BeeperMessage[]
): Promise<ActiveContext[]> {
  const contexts: ActiveContext[] = [];

  // Look for high-frequency topics discussed across multiple chats
  for (const topic of topics.slice(0, 5)) {
    const uniqueChats = new Set(topic.relatedMessages.map(m => m.chatId));

    if (uniqueChats.size >= 2 && topic.frequency >= 3) {
      contexts.push({
        id: `context-${topic.topic}-${Date.now()}`,
        label: topic.topic,
        confidence: Math.min(0.9, topic.frequency / 10 + uniqueChats.size / 5),
        firstDetected: topic.firstMentioned,
        lastUpdated: topic.lastMentioned,
        relatedContacts: [...uniqueChats],
        keyFacts: [],
        platformDistribution: groupByPlatform(topic.relatedMessages),
        status: 'active',
      });
    }
  }

  // Look for distributed info patterns (organizing something)
  for (const info of distributedInfo) {
    if (info.sharedWith.length >= 3) {
      // Create context from distributed info
      const label = extractContextLabel(info.content);
      if (label) {
        contexts.push({
          id: `context-dist-${Date.now()}`,
          label,
          confidence: Math.min(0.9, info.sharedWith.length / 5),
          firstDetected: info.firstShared,
          lastUpdated: info.lastShared,
          relatedContacts: info.sharedWith,
          keyFacts: [
            {
              label: 'shared info',
              value: info.content.slice(0, 100),
              confidence: 0.9,
            },
          ],
          platformDistribution: {},
          status: 'active',
        });
      }
    }
  }

  return contexts.slice(0, 5); // Top 5 contexts
}

function groupByPlatform(
  messages: MessageRef[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const msg of messages) {
    if (!result[msg.platform]) {
      result[msg.platform] = [];
    }
    if (!result[msg.platform].includes(msg.chatId)) {
      result[msg.platform].push(msg.chatId);
    }
  }

  return result;
}

function extractContextLabel(content: string): string | null {
  // Simple heuristics to extract what the content is about
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('party') || lowerContent.includes('birthday')) {
    return 'Party planning';
  }
  if (lowerContent.includes('meeting') || lowerContent.includes('call')) {
    return 'Scheduling meetings';
  }
  if (lowerContent.includes('address') || lowerContent.includes('location')) {
    return 'Sharing location';
  }
  if (lowerContent.includes('trip') || lowerContent.includes('travel')) {
    return 'Trip planning';
  }

  return null;
}
