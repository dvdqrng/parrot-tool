'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AutopilotAgent,
  AgentBehaviorSettings,
  GoalCompletionBehavior,
  DEFAULT_AGENT_BEHAVIOR,
} from '@/lib/types';
import {
  loadAutopilotAgents,
  saveAutopilotAgents,
  getAutopilotAgentById,
  addAutopilotAgent,
  updateAutopilotAgent,
  deleteAutopilotAgent,
  generateId,
} from '@/lib/storage';

export function useAutopilotAgents() {
  const [agents, setAgents] = useState<AutopilotAgent[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load agents on mount
  useEffect(() => {
    const loaded = loadAutopilotAgents();
    setAgents(loaded);
    setIsLoaded(true);
  }, []);

  // Create a new agent
  const createAgent = useCallback((
    data: Omit<AutopilotAgent, 'id' | 'createdAt' | 'updatedAt'>
  ): AutopilotAgent => {
    const now = new Date().toISOString();
    const newAgent: AutopilotAgent = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = addAutopilotAgent(newAgent);
    setAgents(updated);
    return newAgent;
  }, []);

  // Create agent with defaults
  const createAgentWithDefaults = useCallback((
    name: string,
    description: string,
    goal: string,
    systemPrompt: string,
    behaviorOverrides?: Partial<AgentBehaviorSettings>,
    goalCompletionBehavior: GoalCompletionBehavior = 'auto-disable'
  ): AutopilotAgent => {
    return createAgent({
      name,
      description,
      goal,
      systemPrompt,
      behavior: { ...DEFAULT_AGENT_BEHAVIOR, ...behaviorOverrides },
      goalCompletionBehavior,
    });
  }, [createAgent]);

  // Update an existing agent
  const update = useCallback((
    id: string,
    updates: Partial<Omit<AutopilotAgent, 'id' | 'createdAt' | 'updatedAt'>>
  ): void => {
    const updated = updateAutopilotAgent(id, updates);
    setAgents(updated);
  }, []);

  // Delete an agent
  const remove = useCallback((id: string): void => {
    const updated = deleteAutopilotAgent(id);
    setAgents(updated);
  }, []);

  // Get agent by ID
  const getById = useCallback((id: string): AutopilotAgent | undefined => {
    return getAutopilotAgentById(id);
  }, []);

  // Duplicate an agent
  const duplicate = useCallback((id: string): AutopilotAgent | null => {
    const original = getAutopilotAgentById(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicated: AutopilotAgent = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = addAutopilotAgent(duplicated);
    setAgents(updated);
    return duplicated;
  }, []);

  // Sync state from storage (useful after external changes)
  const sync = useCallback(() => {
    const loaded = loadAutopilotAgents();
    setAgents(loaded);
  }, []);

  // Export agents as JSON
  const exportAgents = useCallback((): string => {
    return JSON.stringify(agents, null, 2);
  }, [agents]);

  // Import agents from JSON
  const importAgents = useCallback((json: string, replace: boolean = false): number => {
    try {
      const imported = JSON.parse(json) as AutopilotAgent[];
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const now = new Date().toISOString();
      const newAgents = imported.map(agent => ({
        ...agent,
        id: generateId(), // Generate new IDs to avoid conflicts
        createdAt: now,
        updatedAt: now,
      }));

      if (replace) {
        saveAutopilotAgents(newAgents);
        setAgents(newAgents);
      } else {
        const combined = [...agents, ...newAgents];
        saveAutopilotAgents(combined);
        setAgents(combined);
      }

      return newAgents.length;
    } catch {
      console.error('Failed to import agents');
      return 0;
    }
  }, [agents]);

  return {
    agents,
    isLoaded,
    createAgent,
    createAgentWithDefaults,
    updateAgent: update,
    deleteAgent: remove,
    getAgentById: getById,
    duplicateAgent: duplicate,
    sync,
    exportAgents,
    importAgents,
  };
}
