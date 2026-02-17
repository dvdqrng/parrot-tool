/**
 * Agent System Type Definitions
 * Types for the multi-agent architecture
 */

// ============================================
// AGENT IDENTIFIERS
// ============================================

export type AgentId = string;

export type AgentType =
  | 'interaction_layer'
  | 'orchestrator'
  | 'knowledge'
  | 'style'
  | 'platform'
  | 'user_state'
  | 'conversation'
  | 'activity'
  | 'task'
  | 'trigger';

export type AgentLifecycle =
  | 'active'    // Currently in use (<24h)
  | 'warm'      // Used in last week
  | 'cool'      // Used in last month, compressed
  | 'dormant'   // >30 days, archived
  | 'completed'; // Finished, knowledge archived

// ============================================
// AGENT MEMORY
// ============================================

export interface AgentInteraction {
  id: string;
  timestamp: string;
  type: 'draft' | 'analysis' | 'query' | 'action';
  input: unknown;
  output: unknown;
  userEdits?: string; // For drafts - what the user changed
  accepted: boolean;
}

export interface AgentMemory {
  // Full history for active/warm
  history?: AgentInteraction[];

  // Compressed summary for cool/dormant
  summary?: string;

  // Key learnings that persist
  learnings: string[];

  // Stats
  totalInteractions: number;
  successRate: number;
}

// ============================================
// AGENT
// ============================================

export interface Agent {
  id: AgentId;
  type: AgentType;

  // For dynamic agents
  contextId?: string; // contactId, activityId, taskId
  platform?: string;

  // Lifecycle
  lifecycle: AgentLifecycle;
  createdAt: string;
  lastActiveAt: string;

  // Operational memory
  memory: AgentMemory;
}

// ============================================
// AGENT MESSAGES
// ============================================

export interface AgentMessage {
  from: AgentId;
  to: AgentId;
  type: 'request' | 'response' | 'inform' | 'consult';
  payload: {
    task: string;
    context: Record<string, unknown>;
    constraints?: string[];
    priority: 'high' | 'normal' | 'low';
  };
  conversationId: string;
  timestamp: string;
}

// ============================================
// SYSTEM MESSAGES
// ============================================

export type SystemMessage =
  | { type: 'user_message'; platform: string; contactId: string; content: string }
  | { type: 'agent_report'; agentId: string; reportType: 'draft' | 'analysis' | 'status' | 'alert'; content: unknown }
  | { type: 'extraction_result'; tier: 1 | 2 | 3; contactId?: string; content: unknown }
  | { type: 'user_state_update'; contexts: unknown[]; topics: unknown[] }
  | { type: 'trigger_fired'; triggerId: string; agentId: string; content: unknown }
  | { type: 'crm_alert'; alertType: string; contactIds: string[]; content: unknown }
  | { type: 'conversation_summary'; compressed: string; preservedFacts: string[] }
  | { type: 'system_context'; userProfile: unknown; activeContexts: unknown[] };

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createAgent(
  type: AgentType,
  options: {
    contextId?: string;
    platform?: string;
  } = {}
): Agent {
  const now = new Date().toISOString();
  return {
    id: `${type}-${options.contextId || 'global'}-${Date.now()}`,
    type,
    contextId: options.contextId,
    platform: options.platform,
    lifecycle: 'active',
    createdAt: now,
    lastActiveAt: now,
    memory: {
      learnings: [],
      totalInteractions: 0,
      successRate: 0,
    },
  };
}
