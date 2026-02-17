/**
 * Trigger System Types
 * Defines triggers that can activate agents based on
 * schedules, conditions, patterns, or events
 */

// ============================================
// TRIGGER TYPES
// ============================================

export type TriggerType =
  | 'scheduled'    // Fire at specific time
  | 'recurring'    // Fire on schedule (daily, weekly)
  | 'conditional'  // Fire when condition is met
  | 'pattern'      // Fire when message pattern detected
  | 'event';       // Fire on system event

export type TriggerStatus = 'enabled' | 'disabled' | 'fired' | 'expired';

// ============================================
// TRIGGER CONDITION
// ============================================

export type ConditionType =
  | 'message_from'      // Message received from specific contact
  | 'keyword'           // Keyword detected in message
  | 'no_contact'        // No contact with someone for X days
  | 'context_change'    // Active context changed
  | 'action_due'        // Action item due date approaching
  | 'message_count'     // X messages without response
  | 'time_based';       // Specific time of day

export interface TriggerCondition {
  type: ConditionType;
  params: TriggerConditionParams;
}

export type TriggerConditionParams =
  | MessageFromParams
  | KeywordParams
  | NoContactParams
  | ContextChangeParams
  | ActionDueParams
  | MessageCountParams
  | TimeBasedParams;

export interface MessageFromParams {
  contactId: string;
  platform?: string;
}

export interface KeywordParams {
  keywords: string[];
  matchMode: 'any' | 'all';
  caseSensitive?: boolean;
}

export interface NoContactParams {
  contactId: string;
  days: number;
}

export interface ContextChangeParams {
  contextId?: string; // Specific context, or any
  changeType: 'created' | 'completed' | 'any';
}

export interface ActionDueParams {
  contactId?: string;
  daysBeforeDue: number;
}

export interface MessageCountParams {
  contactId: string;
  count: number;
  direction: 'from_contact' | 'from_me';
}

export interface TimeBasedParams {
  hour: number;
  minute?: number;
  days?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
}

// ============================================
// TRIGGER ACTION
// ============================================

export type ActionType =
  | 'notify'          // Send notification to user
  | 'draft'           // Generate a draft message
  | 'summarize'       // Generate a summary
  | 'execute_agent'   // Run a specific agent
  | 'surface_insight' // Show insight in companion
  | 'reminder';       // Create a reminder

export interface TriggerAction {
  type: ActionType;
  params: TriggerActionParams;
}

export type TriggerActionParams =
  | NotifyParams
  | DraftParams
  | SummarizeParams
  | ExecuteAgentParams
  | SurfaceInsightParams
  | ReminderParams;

export interface NotifyParams {
  title: string;
  message: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface DraftParams {
  contactId: string;
  platform: string;
  intent?: string;
}

export interface SummarizeParams {
  contactId?: string;
  scope: 'conversation' | 'contact' | 'day' | 'week';
}

export interface ExecuteAgentParams {
  agentType: string;
  contextId?: string;
  payload?: Record<string, unknown>;
}

export interface SurfaceInsightParams {
  contactId?: string;
  insightType: 'context' | 'action' | 'suggestion';
  content: string;
}

export interface ReminderParams {
  content: string;
  contactId?: string;
  snoozeMinutes?: number;
}

// ============================================
// SCHEDULE (ICAL-LIKE)
// ============================================

export interface TriggerSchedule {
  // For one-time scheduled triggers
  datetime?: string; // ISO 8601

  // For recurring triggers
  rrule?: {
    freq: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
    byHour?: number;
    byMinute?: number;
    until?: string; // ISO 8601
    count?: number;
  };

  // Timezone
  timezone?: string;
}

// ============================================
// MAIN TRIGGER TYPE
// ============================================

export interface Trigger {
  id: string;
  type: TriggerType;
  name: string;
  description?: string;

  // Owner agent (for agent-created triggers)
  ownerAgentId?: string;

  // Timing
  schedule?: TriggerSchedule;

  // Conditions
  conditions?: TriggerCondition[];
  conditionMode?: 'all' | 'any'; // All conditions must match, or any

  // Action to perform
  action: TriggerAction;

  // State
  status: TriggerStatus;
  lastFired?: string;
  nextFire?: string;
  fireCount: number;

  // Limits
  maxFires?: number;
  cooldownMinutes?: number; // Min time between fires

  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// ============================================
// TRIGGER EVENT
// ============================================

export interface TriggerEvent {
  id: string;
  triggerId: string;
  firedAt: string;
  condition?: TriggerCondition;
  actionTaken: TriggerAction;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
}

// ============================================
// CREATE TRIGGER REQUEST
// ============================================

export interface CreateTriggerRequest {
  type: TriggerType;
  name: string;
  description?: string;
  ownerAgentId?: string;
  schedule?: TriggerSchedule;
  conditions?: TriggerCondition[];
  conditionMode?: 'all' | 'any';
  action: TriggerAction;
  maxFires?: number;
  cooldownMinutes?: number;
  expiresAt?: string;
}
