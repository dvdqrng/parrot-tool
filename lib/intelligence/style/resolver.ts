/**
 * Style Resolver
 * Resolves the appropriate communication style for a given context
 * using a fallback hierarchy: contact → platform → relationship → global
 */

import { StyleFingerprint, RelationshipType } from '../knowledge/types';
import { StyleInstruction, getStyleModel } from './model';
import { clusterByPlatform, clusterByRelationship, StyleCluster } from './clusters';

// ============================================
// RESOLVER CONFIG
// ============================================

export interface ResolverConfig {
  /** Minimum confidence to use a style directly */
  minConfidence: number;
  /** Weight for contact-specific style (highest priority) */
  contactWeight: number;
  /** Weight for platform cluster style */
  platformWeight: number;
  /** Weight for relationship cluster style */
  relationshipWeight: number;
  /** Weight for global baseline */
  globalWeight: number;
}

const DEFAULT_CONFIG: ResolverConfig = {
  minConfidence: 0.4,
  contactWeight: 1.0,
  platformWeight: 0.7,
  relationshipWeight: 0.5,
  globalWeight: 0.3,
};

// ============================================
// RESOLUTION CONTEXT
// ============================================

export interface ResolutionContext {
  contactId?: string;
  platform: string;
  relationshipType?: RelationshipType;
}

export interface ResolvedStyle {
  style: StyleFingerprint;
  instructions: StyleInstruction;
  source: 'contact' | 'platform' | 'relationship' | 'cold_start' | 'global';
  confidence: number;
  fallbackChain: Array<{
    source: string;
    style: StyleFingerprint | null;
    reason?: string;
  }>;
}

// ============================================
// STYLE RESOLVER CLASS
// ============================================

export class StyleResolver {
  private config: ResolverConfig;
  private platformClusters: Map<string, StyleCluster> = new Map();
  private relationshipClusters: Map<RelationshipType, StyleCluster> = new Map();
  private globalBaseline: StyleFingerprint | null = null;

  constructor(config: Partial<ResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize resolver with pre-computed clusters
   */
  initialize(
    platformClusters: Map<string, StyleCluster>,
    relationshipClusters: Map<RelationshipType, StyleCluster>,
    globalBaseline: StyleFingerprint | null
  ): void {
    this.platformClusters = platformClusters;
    this.relationshipClusters = relationshipClusters;
    this.globalBaseline = globalBaseline;
  }

  /**
   * Resolve the best style for a given context
   */
  resolve(context: ResolutionContext): ResolvedStyle {
    const model = getStyleModel();
    const fallbackChain: ResolvedStyle['fallbackChain'] = [];

    // 1. Try contact-specific style (highest priority)
    if (context.contactId) {
      const contactStyle = model.resolveStyle(
        context.contactId,
        context.platform,
        context.relationshipType || 'unknown'
      );

      fallbackChain.push({
        source: 'contact',
        style: contactStyle.confidence > 0 ? contactStyle : null,
        reason: contactStyle.confidence > 0
          ? `Found with confidence ${contactStyle.confidence.toFixed(2)}`
          : 'No contact-specific style',
      });

      if (contactStyle.confidence >= this.config.minConfidence) {
        return {
          style: contactStyle,
          instructions: model.getStyleInstructions(contactStyle),
          source: 'contact',
          confidence: contactStyle.confidence,
          fallbackChain,
        };
      }
    }

    // 2. Try platform cluster
    const platformCluster = this.platformClusters.get(context.platform);
    if (platformCluster) {
      fallbackChain.push({
        source: 'platform',
        style: platformCluster.centroid,
        reason: `${platformCluster.memberCount} samples in cluster`,
      });

      if (platformCluster.confidence >= this.config.minConfidence) {
        return {
          style: platformCluster.centroid,
          instructions: model.getStyleInstructions(platformCluster.centroid),
          source: 'platform',
          confidence: platformCluster.confidence * this.config.platformWeight,
          fallbackChain,
        };
      }
    } else {
      fallbackChain.push({
        source: 'platform',
        style: null,
        reason: 'No platform cluster available',
      });
    }

    // 3. Try relationship cluster
    if (context.relationshipType) {
      const relCluster = this.relationshipClusters.get(context.relationshipType);
      if (relCluster) {
        fallbackChain.push({
          source: 'relationship',
          style: relCluster.centroid,
          reason: `${relCluster.memberCount} samples for ${context.relationshipType}`,
        });

        if (relCluster.confidence >= this.config.minConfidence) {
          return {
            style: relCluster.centroid,
            instructions: model.getStyleInstructions(relCluster.centroid),
            source: 'relationship',
            confidence: relCluster.confidence * this.config.relationshipWeight,
            fallbackChain,
          };
        }
      } else {
        fallbackChain.push({
          source: 'relationship',
          style: null,
          reason: `No cluster for ${context.relationshipType}`,
        });
      }
    }

    // 4. Try global baseline
    if (this.globalBaseline) {
      fallbackChain.push({
        source: 'global',
        style: this.globalBaseline,
        reason: 'Using global baseline',
      });

      if (this.globalBaseline.confidence >= this.config.minConfidence * 0.5) {
        return {
          style: this.globalBaseline,
          instructions: model.getStyleInstructions(this.globalBaseline),
          source: 'global',
          confidence: this.globalBaseline.confidence * this.config.globalWeight,
          fallbackChain,
        };
      }
    }

    // 5. Fall back to cold start
    const coldStart = model.getColdStartStyle(
      context.platform,
      context.relationshipType || 'unknown'
    );

    fallbackChain.push({
      source: 'cold_start',
      style: coldStart,
      reason: 'Using platform/relationship defaults',
    });

    return {
      style: coldStart,
      instructions: model.getStyleInstructions(coldStart),
      source: 'cold_start',
      confidence: coldStart.confidence,
      fallbackChain,
    };
  }

  /**
   * Resolve style with weighted blending from multiple sources
   */
  resolveBlended(context: ResolutionContext): ResolvedStyle {
    const model = getStyleModel();
    const sources: Array<{ style: StyleFingerprint; weight: number; source: string }> = [];

    // Collect all available styles
    if (context.contactId) {
      const contactStyle = model.resolveStyle(
        context.contactId,
        context.platform,
        context.relationshipType || 'unknown'
      );
      if (contactStyle.confidence > 0) {
        sources.push({
          style: contactStyle,
          weight: this.config.contactWeight * contactStyle.confidence,
          source: 'contact',
        });
      }
    }

    const platformCluster = this.platformClusters.get(context.platform);
    if (platformCluster) {
      sources.push({
        style: platformCluster.centroid,
        weight: this.config.platformWeight * platformCluster.confidence,
        source: 'platform',
      });
    }

    if (context.relationshipType) {
      const relCluster = this.relationshipClusters.get(context.relationshipType);
      if (relCluster) {
        sources.push({
          style: relCluster.centroid,
          weight: this.config.relationshipWeight * relCluster.confidence,
          source: 'relationship',
        });
      }
    }

    if (this.globalBaseline) {
      sources.push({
        style: this.globalBaseline,
        weight: this.config.globalWeight * this.globalBaseline.confidence,
        source: 'global',
      });
    }

    // If no sources, use cold start
    if (sources.length === 0) {
      return this.resolve(context);
    }

    // Blend styles
    const blended = this.blendStyles(sources);
    const topSource = sources.sort((a, b) => b.weight - a.weight)[0];

    return {
      style: blended,
      instructions: model.getStyleInstructions(blended),
      source: topSource.source as ResolvedStyle['source'],
      confidence: Math.min(0.9, sources.reduce((sum, s) => sum + s.weight, 0) / sources.length),
      fallbackChain: sources.map(s => ({
        source: s.source,
        style: s.style,
        reason: `Weight: ${s.weight.toFixed(2)}`,
      })),
    };
  }

  /**
   * Blend multiple styles based on weights
   */
  private blendStyles(
    sources: Array<{ style: StyleFingerprint; weight: number }>
  ): StyleFingerprint {
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) return sources[0].style;

    // Weighted average for numeric values
    let avgLength = 0;
    for (const s of sources) {
      avgLength += s.style.avgMessageLength * (s.weight / totalWeight);
    }

    // Weighted mode for categorical values
    const messageBreaking = this.weightedMode(
      sources.map(s => ({ value: s.style.messageBreaking, weight: s.weight }))
    );
    const capitalization = this.weightedMode(
      sources.map(s => ({ value: s.style.capitalization, weight: s.weight }))
    );
    const punctuation = this.weightedMode(
      sources.map(s => ({ value: s.style.punctuation, weight: s.weight }))
    );
    const emojiUsage = this.weightedMode(
      sources.map(s => ({ value: s.style.emojiUsage, weight: s.weight }))
    );
    const formality = this.weightedMode(
      sources.map(s => ({ value: s.style.formality, weight: s.weight }))
    );

    return {
      avgMessageLength: Math.round(avgLength),
      messageBreaking: messageBreaking as StyleFingerprint['messageBreaking'],
      capitalization: capitalization as StyleFingerprint['capitalization'],
      punctuation: punctuation as StyleFingerprint['punctuation'],
      emojiUsage: emojiUsage as StyleFingerprint['emojiUsage'],
      formality: formality as StyleFingerprint['formality'],
      platform: sources[0].style.platform,
      sampleSize: sources.reduce((sum, s) => sum + s.style.sampleSize, 0),
      confidence: totalWeight / sources.length,
      exemplarIds: sources.flatMap(s => s.style.exemplarIds).slice(0, 5),
      lastUpdated: new Date().toISOString(),
    };
  }

  private weightedMode<T>(items: Array<{ value: T; weight: number }>): T {
    const weightedCounts = new Map<T, number>();

    for (const item of items) {
      weightedCounts.set(
        item.value,
        (weightedCounts.get(item.value) || 0) + item.weight
      );
    }

    let maxWeight = 0;
    let maxValue = items[0].value;

    for (const [value, weight] of weightedCounts) {
      if (weight > maxWeight) {
        maxWeight = weight;
        maxValue = value;
      }
    }

    return maxValue;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let resolver: StyleResolver | null = null;

export function getStyleResolver(): StyleResolver {
  if (!resolver) {
    resolver = new StyleResolver();
  }
  return resolver;
}

/**
 * Initialize the global resolver with cluster data
 */
export async function initializeResolver(
  allStyles: Array<{
    contactId: string;
    platform: string;
    style: StyleFingerprint;
    relationshipType?: RelationshipType;
  }>
): Promise<StyleResolver> {
  const resolver = getStyleResolver();

  // Build platform clusters
  const platformClusters = clusterByPlatform(allStyles);

  // Build relationship clusters
  const stylesWithRel = allStyles.filter(s => s.relationshipType);
  const relationshipClusters = clusterByRelationship(
    stylesWithRel.map(s => ({
      ...s,
      relationshipType: s.relationshipType!,
    }))
  );

  // Calculate global baseline
  const model = getStyleModel();
  const globalBaseline = model.buildFingerprint(
    [], // Would need all messages
    'global'
  );

  resolver.initialize(platformClusters, relationshipClusters, globalBaseline);

  return resolver;
}
