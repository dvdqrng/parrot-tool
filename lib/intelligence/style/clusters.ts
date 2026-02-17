/**
 * Style Clusters
 * Groups contacts by communication style for pattern detection
 * and cold-start recommendations.
 */

import { StyleFingerprint, RelationshipType } from '../knowledge/types';

// ============================================
// CLUSTER TYPES
// ============================================

export interface StyleCluster {
  id: string;
  name: string;
  centroid: StyleFingerprint;
  memberCount: number;
  members: ClusterMember[];
  confidence: number;
}

export interface ClusterMember {
  contactId: string;
  platform: string;
  style: StyleFingerprint;
  distance: number; // Distance from centroid
}

export interface ClusteringResult {
  clusters: StyleCluster[];
  platformClusters: Map<string, StyleCluster>;
  relationshipClusters: Map<RelationshipType, StyleCluster>;
}

// ============================================
// STYLE DISTANCE METRICS
// ============================================

/**
 * Calculate distance between two style fingerprints
 * Lower = more similar
 */
export function calculateStyleDistance(
  style1: StyleFingerprint,
  style2: StyleFingerprint
): number {
  let distance = 0;

  // Message length (normalize to 0-1 range, assuming max 500 chars)
  const lenDiff = Math.abs(style1.avgMessageLength - style2.avgMessageLength) / 500;
  distance += lenDiff * 0.15;

  // Message breaking
  if (style1.messageBreaking !== style2.messageBreaking) {
    distance += style1.messageBreaking === 'mixed' || style2.messageBreaking === 'mixed'
      ? 0.05
      : 0.1;
  }

  // Capitalization
  const capMap: Record<StyleFingerprint['capitalization'], number> = {
    'all_lower': 0,
    'mixed': 0.33,
    'proper': 0.67,
    'all_caps': 1,
  };
  distance += Math.abs(capMap[style1.capitalization] - capMap[style2.capitalization]) * 0.15;

  // Punctuation
  const punctMap: Record<StyleFingerprint['punctuation'], number> = {
    'none': 0,
    'minimal': 0.5,
    'full': 1,
  };
  distance += Math.abs(punctMap[style1.punctuation] - punctMap[style2.punctuation]) * 0.15;

  // Emoji usage
  const emojiMap: Record<StyleFingerprint['emojiUsage'], number> = {
    'none': 0,
    'light': 0.33,
    'moderate': 0.67,
    'heavy': 1,
  };
  distance += Math.abs(emojiMap[style1.emojiUsage] - emojiMap[style2.emojiUsage]) * 0.2;

  // Formality
  const formalMap: Record<StyleFingerprint['formality'], number> = {
    'very_casual': 0,
    'casual': 0.5,
    'formal': 1,
  };
  distance += Math.abs(formalMap[style1.formality] - formalMap[style2.formality]) * 0.25;

  return Math.min(1, distance);
}

// ============================================
// CENTROID CALCULATION
// ============================================

/**
 * Calculate the centroid (average) of a set of styles
 */
export function calculateCentroid(styles: StyleFingerprint[]): StyleFingerprint {
  if (styles.length === 0) {
    return createDefaultStyle();
  }

  if (styles.length === 1) {
    return { ...styles[0] };
  }

  // Average numeric values
  const avgLength = average(styles.map(s => s.avgMessageLength));
  const avgSampleSize = average(styles.map(s => s.sampleSize));
  const avgConfidence = average(styles.map(s => s.confidence));

  // Mode for categorical values
  const messageBreaking = mode(styles.map(s => s.messageBreaking)) || 'mixed';
  const capitalization = mode(styles.map(s => s.capitalization)) || 'proper';
  const punctuation = mode(styles.map(s => s.punctuation)) || 'minimal';
  const emojiUsage = mode(styles.map(s => s.emojiUsage)) || 'light';
  const formality = mode(styles.map(s => s.formality)) || 'casual';
  const platform = mode(styles.map(s => s.platform)) || 'unknown';

  return {
    avgMessageLength: Math.round(avgLength),
    messageBreaking,
    capitalization,
    punctuation,
    emojiUsage,
    formality,
    platform,
    sampleSize: Math.round(avgSampleSize),
    confidence: avgConfidence,
    exemplarIds: [],
    lastUpdated: new Date().toISOString(),
  };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;

  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let maxItem: T | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }

  return maxItem;
}

function createDefaultStyle(): StyleFingerprint {
  return {
    avgMessageLength: 50,
    messageBreaking: 'mixed',
    capitalization: 'proper',
    punctuation: 'minimal',
    emojiUsage: 'light',
    formality: 'casual',
    platform: 'unknown',
    sampleSize: 0,
    confidence: 0,
    exemplarIds: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// CLUSTERING ALGORITHMS
// ============================================

/**
 * K-means clustering for styles
 */
export function clusterStyles(
  styles: Array<{ contactId: string; platform: string; style: StyleFingerprint }>,
  k: number = 5
): StyleCluster[] {
  if (styles.length === 0) return [];
  if (styles.length <= k) {
    // Not enough for clustering, each style is its own cluster
    return styles.map((s, i) => ({
      id: `cluster-${i}`,
      name: `Style ${i + 1}`,
      centroid: s.style,
      memberCount: 1,
      members: [{ ...s, distance: 0 }],
      confidence: s.style.confidence,
    }));
  }

  // Initialize centroids by picking k random styles
  let centroids = pickRandomCentroids(styles.map(s => s.style), k);
  let assignments = new Map<number, typeof styles>();
  let iterations = 0;
  const maxIterations = 20;

  // Iterate until convergence or max iterations
  while (iterations < maxIterations) {
    iterations++;

    // Assign each style to nearest centroid
    const newAssignments = new Map<number, typeof styles>();
    for (let i = 0; i < k; i++) {
      newAssignments.set(i, []);
    }

    for (const item of styles) {
      let minDistance = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const distance = calculateStyleDistance(item.style, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      }

      newAssignments.get(nearestCluster)!.push(item);
    }

    // Check for convergence
    let changed = false;
    for (let i = 0; i < k; i++) {
      const oldMembers = assignments.get(i) || [];
      const newMembers = newAssignments.get(i) || [];
      if (oldMembers.length !== newMembers.length) {
        changed = true;
        break;
      }
    }

    assignments = newAssignments;

    if (!changed) break;

    // Recalculate centroids
    const newCentroids: StyleFingerprint[] = [];
    for (let i = 0; i < k; i++) {
      const members = assignments.get(i) || [];
      if (members.length > 0) {
        newCentroids.push(calculateCentroid(members.map(m => m.style)));
      } else {
        // Keep old centroid if cluster is empty
        newCentroids.push(centroids[i]);
      }
    }
    centroids = newCentroids;
  }

  // Build cluster objects
  const clusters: StyleCluster[] = [];
  for (let i = 0; i < k; i++) {
    const members = assignments.get(i) || [];
    if (members.length === 0) continue;

    const centroid = centroids[i];
    const clusterMembers: ClusterMember[] = members.map(m => ({
      ...m,
      distance: calculateStyleDistance(m.style, centroid),
    }));

    clusters.push({
      id: `cluster-${i}`,
      name: generateClusterName(centroid),
      centroid,
      memberCount: members.length,
      members: clusterMembers,
      confidence: average(members.map(m => m.style.confidence)),
    });
  }

  return clusters.sort((a, b) => b.memberCount - a.memberCount);
}

function pickRandomCentroids(styles: StyleFingerprint[], k: number): StyleFingerprint[] {
  const shuffled = [...styles].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

/**
 * Generate a human-readable name for a cluster based on its centroid
 */
function generateClusterName(centroid: StyleFingerprint): string {
  const parts: string[] = [];

  // Formality
  if (centroid.formality === 'formal') parts.push('Formal');
  else if (centroid.formality === 'very_casual') parts.push('Very Casual');

  // Emoji
  if (centroid.emojiUsage === 'heavy') parts.push('Emoji-heavy');
  else if (centroid.emojiUsage === 'none') parts.push('No-emoji');

  // Length
  if (centroid.messageBreaking === 'multiple_short') parts.push('Short messages');
  else if (centroid.messageBreaking === 'single_long') parts.push('Long messages');

  if (parts.length === 0) {
    parts.push('Mixed style');
  }

  return parts.join(', ');
}

// ============================================
// PLATFORM & RELATIONSHIP CLUSTERING
// ============================================

/**
 * Group styles by platform
 */
export function clusterByPlatform(
  styles: Array<{ contactId: string; platform: string; style: StyleFingerprint }>
): Map<string, StyleCluster> {
  const byPlatform = new Map<string, typeof styles>();

  for (const item of styles) {
    const platform = item.platform || 'unknown';
    const list = byPlatform.get(platform) || [];
    list.push(item);
    byPlatform.set(platform, list);
  }

  const result = new Map<string, StyleCluster>();

  for (const [platform, members] of byPlatform) {
    if (members.length === 0) continue;

    const centroid = calculateCentroid(members.map(m => m.style));
    const clusterMembers: ClusterMember[] = members.map(m => ({
      ...m,
      distance: calculateStyleDistance(m.style, centroid),
    }));

    result.set(platform, {
      id: `platform-${platform}`,
      name: `${platform} style`,
      centroid,
      memberCount: members.length,
      members: clusterMembers,
      confidence: average(members.map(m => m.style.confidence)),
    });
  }

  return result;
}

/**
 * Group styles by relationship type (requires relationship data)
 */
export function clusterByRelationship(
  stylesWithRelationship: Array<{
    contactId: string;
    platform: string;
    style: StyleFingerprint;
    relationshipType: RelationshipType;
  }>
): Map<RelationshipType, StyleCluster> {
  const byRelationship = new Map<RelationshipType, typeof stylesWithRelationship>();

  for (const item of stylesWithRelationship) {
    const list = byRelationship.get(item.relationshipType) || [];
    list.push(item);
    byRelationship.set(item.relationshipType, list);
  }

  const result = new Map<RelationshipType, StyleCluster>();

  for (const [relType, members] of byRelationship) {
    if (members.length === 0) continue;

    const centroid = calculateCentroid(members.map(m => m.style));
    const clusterMembers: ClusterMember[] = members.map(m => ({
      contactId: m.contactId,
      platform: m.platform,
      style: m.style,
      distance: calculateStyleDistance(m.style, centroid),
    }));

    result.set(relType, {
      id: `relationship-${relType}`,
      name: `${relType.replace('_', ' ')} style`,
      centroid,
      memberCount: members.length,
      members: clusterMembers,
      confidence: average(members.map(m => m.style.confidence)),
    });
  }

  return result;
}

// ============================================
// STYLE SIMILARITY
// ============================================

/**
 * Find contacts with similar communication styles
 */
export function findSimilarStyles(
  targetStyle: StyleFingerprint,
  allStyles: Array<{ contactId: string; platform: string; style: StyleFingerprint }>,
  limit: number = 5
): Array<{ contactId: string; platform: string; similarity: number }> {
  const scored = allStyles.map(item => ({
    contactId: item.contactId,
    platform: item.platform,
    similarity: 1 - calculateStyleDistance(targetStyle, item.style),
  }));

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
