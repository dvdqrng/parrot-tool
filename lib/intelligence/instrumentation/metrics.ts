/**
 * Intelligence Metrics
 * Tracks performance, quality, and usage metrics for the intelligence layer
 */

// ============================================
// METRIC TYPES
// ============================================

export interface IntelligenceMetrics {
  // Draft quality
  drafts: {
    generated: number;
    accepted: number;
    edited: number;
    rejected: number;
    acceptanceRate: number;
    editRate: {
      noEdits: number;
      minorEdits: number;
      majorEdits: number;
    };
  };

  // Extraction accuracy
  extraction: {
    tier1Runs: number;
    tier2Runs: number;
    tier3Runs: number;
    factsExtracted: number;
    factsEdited: number;
    factEditRate: number;
    contradictionsDetected: number;
    contradictionsResolved: number;
  };

  // Agent efficiency
  agents: {
    total: number;
    active: number;
    warm: number;
    cool: number;
    dormant: number;
    spawned: number;
    reused: number;
    reuseRate: number;
    avgResponseTimeMs: number;
  };

  // User state
  userState: {
    activeContexts: number;
    topicsTracked: number;
    distributedInfoItems: number;
    canonicalExplanations: number;
    overrideCount: number;
    overrideRate: number;
  };

  // Triggers
  triggers: {
    total: number;
    enabled: number;
    fired: number;
    successRate: number;
  };

  // Cost tracking
  cost: {
    estimatedDailyUsd: number;
    apiCalls: number;
    tokensUsed: {
      input: number;
      output: number;
    };
  };

  // Performance
  performance: {
    avgInitTimeMs: number;
    avgQueryTimeMs: number;
    storeSizeKb: number;
  };

  // Cross-chat intelligence
  crossChat: {
    factsUsedAcrossChats: number;
    userStateUsageRate: number;
    contextSharing: number;
  };

  // Time tracking
  period: {
    start: string;
    end: string;
    durationHours: number;
  };
}

// ============================================
// METRIC COLLECTOR
// ============================================

interface MetricEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

class MetricsCollector {
  private events: MetricEvent[] = [];
  private counters: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();
  private periodStart: string;

  constructor() {
    this.periodStart = new Date().toISOString();
  }

  /**
   * Increment a counter
   */
  increment(metric: string, amount: number = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + amount);
  }

  /**
   * Record a timing
   */
  timing(metric: string, durationMs: number): void {
    const timings = this.timings.get(metric) || [];
    timings.push(durationMs);
    // Keep last 1000 timings
    if (timings.length > 1000) timings.shift();
    this.timings.set(metric, timings);
  }

  /**
   * Record an event
   */
  event(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({
      type,
      timestamp: new Date().toISOString(),
      data,
    });

    // Keep last 1000 events
    if (this.events.length > 1000) this.events.shift();
  }

  /**
   * Get counter value
   */
  getCounter(metric: string): number {
    return this.counters.get(metric) || 0;
  }

  /**
   * Get timing stats
   */
  getTimingStats(metric: string): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    count: number;
  } {
    const timings = this.timings.get(metric) || [];
    if (timings.length === 0) {
      return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, count: 0 };
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      count: sorted.length,
    };
  }

  /**
   * Get recent events
   */
  getEvents(type?: string, limit: number = 100): MetricEvent[] {
    let events = this.events;
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events.slice(-limit);
  }

  /**
   * Calculate rate between two counters
   */
  calculateRate(numerator: string, denominator: string): number {
    const num = this.getCounter(numerator);
    const denom = this.getCounter(denominator);
    return denom > 0 ? num / denom : 0;
  }

  /**
   * Reset counters (for new period)
   */
  reset(): void {
    this.counters.clear();
    this.timings.clear();
    this.events = [];
    this.periodStart = new Date().toISOString();
  }

  /**
   * Get period duration in hours
   */
  getPeriodHours(): number {
    const start = new Date(this.periodStart).getTime();
    const now = Date.now();
    return (now - start) / (60 * 60 * 1000);
  }
}

// ============================================
// GLOBAL COLLECTOR
// ============================================

const collector = new MetricsCollector();

// ============================================
// METRIC RECORDING HELPERS
// ============================================

export const metrics = {
  // Draft metrics
  draftGenerated: () => collector.increment('drafts.generated'),
  draftAccepted: () => collector.increment('drafts.accepted'),
  draftEdited: (editLevel: 'none' | 'minor' | 'major') => {
    collector.increment('drafts.edited');
    collector.increment(`drafts.edit.${editLevel}`);
  },
  draftRejected: () => collector.increment('drafts.rejected'),

  // Extraction metrics
  tier1Extraction: () => collector.increment('extraction.tier1'),
  tier2Extraction: () => collector.increment('extraction.tier2'),
  tier3Extraction: () => collector.increment('extraction.tier3'),
  factExtracted: (count: number = 1) => collector.increment('extraction.facts', count),
  factEdited: () => collector.increment('extraction.factsEdited'),
  contradictionDetected: () => collector.increment('extraction.contradictions'),
  contradictionResolved: () => collector.increment('extraction.contradictionsResolved'),

  // Agent metrics
  agentSpawned: (type: string) => {
    collector.increment('agents.spawned');
    collector.increment(`agents.spawned.${type}`);
  },
  agentReused: () => collector.increment('agents.reused'),
  agentResponse: (durationMs: number) => collector.timing('agents.responseTime', durationMs),

  // User state metrics
  userStateOverride: () => collector.increment('userState.overrides'),
  contextCreated: () => collector.increment('userState.contextsCreated'),
  contextCompleted: () => collector.increment('userState.contextsCompleted'),

  // Trigger metrics
  triggerFired: (success: boolean) => {
    collector.increment('triggers.fired');
    if (success) collector.increment('triggers.succeeded');
  },

  // Cost metrics
  apiCall: (tokens: { input: number; output: number }) => {
    collector.increment('cost.apiCalls');
    collector.increment('cost.tokens.input', tokens.input);
    collector.increment('cost.tokens.output', tokens.output);
  },

  // Performance metrics
  initTime: (ms: number) => collector.timing('performance.initTime', ms),
  queryTime: (ms: number) => collector.timing('performance.queryTime', ms),

  // Cross-chat metrics
  factUsedCrossChat: () => collector.increment('crossChat.factsUsed'),
  userStateUsed: () => collector.increment('crossChat.userStateUsed'),
  contextShared: () => collector.increment('crossChat.contextShared'),

  // Generic event
  event: (type: string, data?: Record<string, unknown>) => collector.event(type, data),
};

// ============================================
// METRICS AGGREGATION
// ============================================

export async function getIntelligenceMetrics(): Promise<IntelligenceMetrics> {
  const now = new Date().toISOString();
  const periodHours = collector.getPeriodHours();

  // Draft metrics
  const draftsGenerated = collector.getCounter('drafts.generated');
  const draftsAccepted = collector.getCounter('drafts.accepted');
  const draftsEdited = collector.getCounter('drafts.edited');
  const draftsRejected = collector.getCounter('drafts.rejected');

  // Extraction metrics
  const tier1 = collector.getCounter('extraction.tier1');
  const tier2 = collector.getCounter('extraction.tier2');
  const tier3 = collector.getCounter('extraction.tier3');
  const factsExtracted = collector.getCounter('extraction.facts');
  const factsEdited = collector.getCounter('extraction.factsEdited');

  // Agent metrics
  const agentsSpawned = collector.getCounter('agents.spawned');
  const agentsReused = collector.getCounter('agents.reused');
  const responseTimeStats = collector.getTimingStats('agents.responseTime');

  // User state metrics
  const overrides = collector.getCounter('userState.overrides');
  const contextsCreated = collector.getCounter('userState.contextsCreated');

  // Trigger metrics
  const triggersFired = collector.getCounter('triggers.fired');
  const triggersSucceeded = collector.getCounter('triggers.succeeded');

  // Cost metrics
  const apiCalls = collector.getCounter('cost.apiCalls');
  const inputTokens = collector.getCounter('cost.tokens.input');
  const outputTokens = collector.getCounter('cost.tokens.output');

  // Estimate cost (rough approximation: $3/M input, $15/M output)
  const estimatedCost =
    (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  const dailyCost = periodHours > 0 ? (estimatedCost / periodHours) * 24 : 0;

  // Performance
  const initTimeStats = collector.getTimingStats('performance.initTime');
  const queryTimeStats = collector.getTimingStats('performance.queryTime');

  // Cross-chat
  const factsUsedCrossChat = collector.getCounter('crossChat.factsUsed');
  const userStateUsed = collector.getCounter('crossChat.userStateUsed');
  const contextShared = collector.getCounter('crossChat.contextShared');

  return {
    drafts: {
      generated: draftsGenerated,
      accepted: draftsAccepted,
      edited: draftsEdited,
      rejected: draftsRejected,
      acceptanceRate: draftsGenerated > 0 ? draftsAccepted / draftsGenerated : 0,
      editRate: {
        noEdits: collector.getCounter('drafts.edit.none'),
        minorEdits: collector.getCounter('drafts.edit.minor'),
        majorEdits: collector.getCounter('drafts.edit.major'),
      },
    },
    extraction: {
      tier1Runs: tier1,
      tier2Runs: tier2,
      tier3Runs: tier3,
      factsExtracted,
      factsEdited,
      factEditRate: factsExtracted > 0 ? factsEdited / factsExtracted : 0,
      contradictionsDetected: collector.getCounter('extraction.contradictions'),
      contradictionsResolved: collector.getCounter('extraction.contradictionsResolved'),
    },
    agents: {
      total: 0, // Would come from store
      active: 0,
      warm: 0,
      cool: 0,
      dormant: 0,
      spawned: agentsSpawned,
      reused: agentsReused,
      reuseRate: agentsSpawned + agentsReused > 0
        ? agentsReused / (agentsSpawned + agentsReused)
        : 0,
      avgResponseTimeMs: responseTimeStats.avg,
    },
    userState: {
      activeContexts: 0, // Would come from store
      topicsTracked: 0,
      distributedInfoItems: 0,
      canonicalExplanations: 0,
      overrideCount: overrides,
      overrideRate: contextsCreated > 0 ? overrides / contextsCreated : 0,
    },
    triggers: {
      total: 0, // Would come from store
      enabled: 0,
      fired: triggersFired,
      successRate: triggersFired > 0 ? triggersSucceeded / triggersFired : 0,
    },
    cost: {
      estimatedDailyUsd: dailyCost,
      apiCalls,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
      },
    },
    performance: {
      avgInitTimeMs: initTimeStats.avg,
      avgQueryTimeMs: queryTimeStats.avg,
      storeSizeKb: 0, // Would calculate from IndexedDB
    },
    crossChat: {
      factsUsedAcrossChats: factsUsedCrossChat,
      userStateUsageRate: draftsGenerated > 0 ? userStateUsed / draftsGenerated : 0,
      contextSharing: contextShared,
    },
    period: {
      start: collector['periodStart'],
      end: now,
      durationHours: periodHours,
    },
  };
}

/**
 * Get raw collector for advanced usage
 */
export function getCollector(): MetricsCollector {
  return collector;
}

/**
 * Reset metrics for new period
 */
export function resetMetrics(): void {
  collector.reset();
}
