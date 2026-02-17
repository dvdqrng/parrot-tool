/**
 * Agent Orchestrator
 * Routes requests to appropriate agents and manages agent lifecycle
 */

import { Agent, AgentType, AgentLifecycle, AgentMessage, AgentMemory } from './types';
import { agentStore } from '../knowledge/store';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[Orchestrator]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// ORCHESTRATOR CONFIG
// ============================================

export interface OrchestratorConfig {
  /** Maximum number of active agents */
  maxActiveAgents: number;
  /** Hours before an agent becomes "warm" */
  warmThresholdHours: number;
  /** Days before an agent becomes "cool" */
  coolThresholdDays: number;
  /** Days before an agent becomes "dormant" */
  dormantThresholdDays: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxActiveAgents: 50,
  warmThresholdHours: 24,
  coolThresholdDays: 7,
  dormantThresholdDays: 30,
};

// ============================================
// AGENT REQUEST
// ============================================

export interface AgentRequest {
  type: AgentType;
  contextId?: string; // For dynamic agents (contactId, activityId, etc.)
  platform?: string;
  priority: 'high' | 'normal' | 'low';
  payload: Record<string, unknown>;
}

export interface AgentResponse {
  agent: Agent;
  result: unknown;
  duration: number;
}

// ============================================
// ORCHESTRATOR CLASS
// ============================================

export class Orchestrator {
  private config: OrchestratorConfig;
  private activeAgents: Map<string, Agent> = new Map();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log('constructor', 'Orchestrator initialized', { config: this.config });
  }

  /**
   * Route a request to the appropriate agent
   */
  async route(request: AgentRequest): Promise<Agent> {
    log('route', 'Routing request', {
      type: request.type,
      contextId: request.contextId,
      platform: request.platform,
      priority: request.priority,
    });

    // 1. Check for existing agent
    let agent = await this.findExistingAgent(request);

    if (agent) {
      log('route', 'Found existing agent', { id: agent.id, lifecycle: agent.lifecycle });
      // Reactivate if not already active
      if (agent.lifecycle !== 'active') {
        await this.reactivateAgent(agent);
      }
      return agent;
    }

    log('route', 'No existing agent, checking roster limits...');
    // 2. Check roster limits before spawning
    await this.enforceRosterLimits();

    // 3. Spawn new agent
    log('route', 'Spawning new agent...');
    agent = await this.spawnAgent(request);

    return agent;
  }

  /**
   * Find an existing agent that can handle this request
   */
  private async findExistingAgent(request: AgentRequest): Promise<Agent | null> {
    // Check in-memory cache first
    const cacheKey = this.getAgentCacheKey(request);
    const cached = this.activeAgents.get(cacheKey);
    if (cached) return cached;

    // Check store
    if (request.contextId) {
      const agent = await agentStore.getByContext(request.contextId, request.platform);
      if (agent && agent.type === request.type) {
        this.activeAgents.set(cacheKey, agent);
        return agent;
      }
    }

    // For infrastructure agents (singleton), check by type
    if (this.isInfrastructureAgent(request.type)) {
      const agents = await agentStore.getByType(request.type);
      if (agents.length > 0) {
        const agent = agents[0];
        this.activeAgents.set(cacheKey, agent);
        return agent;
      }
    }

    return null;
  }

  private getAgentCacheKey(request: AgentRequest): string {
    if (request.contextId && request.platform) {
      return `${request.type}-${request.contextId}-${request.platform}`;
    }
    if (request.contextId) {
      return `${request.type}-${request.contextId}`;
    }
    return request.type;
  }

  private isInfrastructureAgent(type: AgentType): boolean {
    return ['knowledge', 'style', 'platform', 'user_state', 'orchestrator'].includes(type);
  }

  /**
   * Spawn a new agent
   */
  private async spawnAgent(request: AgentRequest): Promise<Agent> {
    const now = new Date().toISOString();

    const agent: Agent = {
      id: `agent-${request.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: request.type,
      contextId: request.contextId,
      platform: request.platform,
      lifecycle: 'active',
      createdAt: now,
      lastActiveAt: now,
      memory: {
        history: [],
        learnings: [],
        totalInteractions: 0,
        successRate: 1,
      },
    };

    await agentStore.upsert(agent);

    const cacheKey = this.getAgentCacheKey(request);
    this.activeAgents.set(cacheKey, agent);

    return agent;
  }

  /**
   * Reactivate a dormant or cool agent
   */
  private async reactivateAgent(agent: Agent): Promise<void> {
    const updated: Agent = {
      ...agent,
      lifecycle: 'active',
      lastActiveAt: new Date().toISOString(),
    };

    // Decompress memory if needed
    if (agent.memory.summary && !agent.memory.history) {
      updated.memory = {
        ...agent.memory,
        history: [], // Start fresh history, keep summary
      };
    }

    await agentStore.upsert(updated);

    const cacheKey = `${agent.type}-${agent.contextId || ''}-${agent.platform || ''}`.replace(/-+$/, '');
    this.activeAgents.set(cacheKey, updated);
  }

  /**
   * Enforce roster limits by transitioning agents
   */
  private async enforceRosterLimits(): Promise<void> {
    const activeCount = await agentStore.countActive();

    if (activeCount < this.config.maxActiveAgents) {
      return;
    }

    // Get all active/warm agents
    const activeAgents = await agentStore.getByLifecycle('active');
    const warmAgents = await agentStore.getByLifecycle('warm');

    // Sort by last active time (oldest first)
    const allAgents = [...activeAgents, ...warmAgents].sort(
      (a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
    );

    // Transition oldest agents to cool/dormant
    const toTransition = allAgents.slice(0, Math.min(10, activeCount - this.config.maxActiveAgents + 10));

    for (const agent of toTransition) {
      await this.transitionAgent(agent.id, 'cool');
    }
  }

  /**
   * Transition an agent to a new lifecycle state
   */
  async transitionAgent(agentId: string, newLifecycle: AgentLifecycle): Promise<void> {
    const agent = await agentStore.get(agentId);
    if (!agent) return;

    const updated: Agent = {
      ...agent,
      lifecycle: newLifecycle,
    };

    // Compress memory for cool/dormant states
    if (newLifecycle === 'cool' || newLifecycle === 'dormant') {
      updated.memory = this.compressMemory(agent.memory);
    }

    await agentStore.upsert(updated);

    // Remove from active cache
    for (const [key, cachedAgent] of this.activeAgents) {
      if (cachedAgent.id === agentId) {
        this.activeAgents.delete(key);
        break;
      }
    }
  }

  /**
   * Compress agent memory for storage efficiency
   */
  private compressMemory(memory: AgentMemory): AgentMemory {
    // Generate summary from history
    let summary = memory.summary || '';

    if (memory.history && memory.history.length > 0) {
      const interactions = memory.history
        .slice(-10)
        .map(i => `[${i.type}] ${i.accepted ? 'Accepted' : 'Rejected'}`)
        .join('; ');

      summary = `${memory.totalInteractions} total interactions (${Math.round(memory.successRate * 100)}% success). Recent: ${interactions}`;
    }

    return {
      summary,
      learnings: memory.learnings,
      totalInteractions: memory.totalInteractions,
      successRate: memory.successRate,
      // Clear history to save space
      history: undefined,
    };
  }

  /**
   * Run lifecycle maintenance on all agents
   */
  async runLifecycleMaintenance(): Promise<{
    transitioned: number;
    archived: number;
  }> {
    const now = Date.now();
    let transitioned = 0;
    let archived = 0;

    // Get all non-dormant agents
    const activeAgents = await agentStore.getByLifecycle('active');
    const warmAgents = await agentStore.getByLifecycle('warm');
    const coolAgents = await agentStore.getByLifecycle('cool');

    for (const agent of [...activeAgents, ...warmAgents, ...coolAgents]) {
      const lastActiveMs = new Date(agent.lastActiveAt).getTime();
      const ageMs = now - lastActiveMs;
      const ageHours = ageMs / (60 * 60 * 1000);
      const ageDays = ageHours / 24;

      let newLifecycle: AgentLifecycle | null = null;

      switch (agent.lifecycle) {
        case 'active':
          if (ageHours > this.config.warmThresholdHours) {
            newLifecycle = 'warm';
          }
          break;
        case 'warm':
          if (ageDays > this.config.coolThresholdDays) {
            newLifecycle = 'cool';
          }
          break;
        case 'cool':
          if (ageDays > this.config.dormantThresholdDays) {
            newLifecycle = 'dormant';
          }
          break;
      }

      if (newLifecycle) {
        await this.transitionAgent(agent.id, newLifecycle);
        if (newLifecycle === 'dormant') {
          archived++;
        } else {
          transitioned++;
        }
      }
    }

    return { transitioned, archived };
  }

  /**
   * Record an interaction with an agent
   */
  async recordInteraction(
    agentId: string,
    interaction: {
      type: 'draft' | 'analysis' | 'query' | 'action';
      input: unknown;
      output: unknown;
      userEdits?: string;
      accepted: boolean;
    }
  ): Promise<void> {
    const agent = await agentStore.get(agentId);
    if (!agent) return;

    const now = new Date().toISOString();

    const updated: Agent = {
      ...agent,
      lastActiveAt: now,
      lifecycle: 'active',
      memory: {
        ...agent.memory,
        history: [
          ...(agent.memory.history || []).slice(-100), // Keep last 100
          {
            id: `int-${Date.now()}`,
            timestamp: now,
            ...interaction,
          },
        ],
        totalInteractions: agent.memory.totalInteractions + 1,
        successRate: this.calculateSuccessRate(agent.memory, interaction.accepted),
      },
    };

    await agentStore.upsert(updated);

    // Update cache
    for (const [key, cachedAgent] of this.activeAgents) {
      if (cachedAgent.id === agentId) {
        this.activeAgents.set(key, updated);
        break;
      }
    }
  }

  private calculateSuccessRate(
    memory: AgentMemory,
    newAccepted: boolean
  ): number {
    const total = memory.totalInteractions + 1;
    const previousSuccesses = Math.round(memory.successRate * memory.totalInteractions);
    const newSuccesses = previousSuccesses + (newAccepted ? 1 : 0);
    return newSuccesses / total;
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<{
    total: number;
    byLifecycle: Record<AgentLifecycle, number>;
    byType: Record<string, number>;
    cacheSize: number;
  }> {
    const all = await agentStore.getAll();

    const byLifecycle: Record<AgentLifecycle, number> = {
      active: 0,
      warm: 0,
      cool: 0,
      dormant: 0,
      completed: 0,
    };

    const byType: Record<string, number> = {};

    for (const agent of all) {
      byLifecycle[agent.lifecycle]++;
      byType[agent.type] = (byType[agent.type] || 0) + 1;
    }

    return {
      total: all.length,
      byLifecycle,
      byType,
      cacheSize: this.activeAgents.size,
    };
  }

  /**
   * Clean up and archive completed agents
   */
  async archiveCompletedAgents(): Promise<number> {
    const dormantAgents = await agentStore.getByLifecycle('dormant');
    const now = Date.now();
    let archived = 0;

    for (const agent of dormantAgents) {
      const ageDays = (now - new Date(agent.lastActiveAt).getTime()) / (24 * 60 * 60 * 1000);

      // Archive agents dormant for > 60 days
      if (ageDays > 60) {
        await agentStore.updateLifecycle(agent.id, 'completed');
        archived++;
      }
    }

    return archived;
  }

  /**
   * Get orchestrator status for dashboard
   */
  async getStatus(): Promise<{
    totalAgents: number;
    byState: Record<AgentLifecycle, number>;
    agents: Agent[];
  }> {
    const all = await agentStore.getAll();

    const byState: Record<AgentLifecycle, number> = {
      active: 0,
      warm: 0,
      cool: 0,
      dormant: 0,
      completed: 0,
    };

    for (const agent of all) {
      byState[agent.lifecycle]++;
    }

    return {
      totalAgents: all.length,
      byState,
      agents: all,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let orchestrator: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}
