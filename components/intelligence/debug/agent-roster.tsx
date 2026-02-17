'use client';

/**
 * Agent Roster
 * Display and manage the multi-agent system for debugging
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Agent,
  AgentLifecycle,
} from '@/lib/intelligence/agents/types';
import { getOrchestrator } from '@/lib/intelligence/agents/orchestrator';
import {
  RefreshCw,
  Bot,
  Zap,
  Moon,
  Sun,
  Snowflake,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';

const STATE_ICONS: Record<AgentLifecycle, React.ReactNode> = {
  active: <Zap className="w-4 h-4 text-green-500" />,
  warm: <Sun className="w-4 h-4 text-yellow-500" />,
  cool: <Moon className="w-4 h-4 text-blue-500" />,
  dormant: <Snowflake className="w-4 h-4 text-slate-500" />,
  completed: <CheckCircle className="w-4 h-4 text-muted-foreground" />,
};

const STATE_COLORS: Record<AgentLifecycle, string> = {
  active: 'bg-green-500',
  warm: 'bg-yellow-500',
  cool: 'bg-blue-500',
  dormant: 'bg-slate-500',
  completed: 'bg-muted-foreground',
};

export function AgentRoster() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    warm: 0,
    cool: 0,
    dormant: 0,
    completed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orchestrator = getOrchestrator();
      const status = await orchestrator.getStatus();

      setAgents(status.agents);
      setStats({
        total: status.totalAgents,
        active: status.byState.active,
        warm: status.byState.warm,
        cool: status.byState.cool,
        dormant: status.byState.dormant,
        completed: status.byState.completed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    // Refresh every 10 seconds
    const interval = setInterval(loadAgents, 10000);
    return () => clearInterval(interval);
  }, [loadAgents]);

  const handleRunMaintenance = async () => {
    try {
      const orchestrator = getOrchestrator();
      await orchestrator.runLifecycleMaintenance();
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Maintenance failed');
    }
  };

  if (isLoading && agents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxAgents = 50; // From orchestrator config
  const usagePercent = (stats.total / maxAgents) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Roster</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRunMaintenance}>
            <Trash2 className="w-4 h-4 mr-2" />
            Run Maintenance
          </Button>
          <Button variant="outline" size="sm" onClick={loadAgents}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Roster Capacity */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Roster Capacity</span>
            <span className="text-sm text-muted-foreground">
              {stats.total} / {maxAgents}
            </span>
          </div>
          <Progress value={usagePercent} className="h-2" />
        </CardContent>
      </Card>

      {/* State Distribution */}
      <div className="grid grid-cols-5 gap-4">
        <StateCard state="active" count={stats.active} />
        <StateCard state="warm" count={stats.warm} />
        <StateCard state="cool" count={stats.cool} />
        <StateCard state="dormant" count={stats.dormant} />
        <StateCard state="completed" count={stats.completed} />
      </div>

      {/* Agent List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">All Agents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
              {agents.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No agents in roster
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// STATE CARD
// ============================================

function StateCard({ state, count }: { state: AgentLifecycle; count: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {STATE_ICONS[state]}
          <span className="text-xs capitalize text-muted-foreground">{state}</span>
        </div>
        <div className="text-2xl font-bold">{count}</div>
      </CardContent>
    </Card>
  );
}

// ============================================
// AGENT CARD
// ============================================

function AgentCard({ agent }: { agent: Agent }) {
  const timeSinceActive = agent.lastActiveAt
    ? Math.floor((Date.now() - new Date(agent.lastActiveAt).getTime()) / 1000 / 60)
    : null;

  return (
    <div className="p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Bot className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{agent.id}</span>
            {STATE_ICONS[agent.lifecycle]}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {agent.type}
            </Badge>
            {agent.contextId && (
              <span className="text-xs text-muted-foreground truncate">
                {agent.contextId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>
              Created: {new Date(agent.createdAt).toLocaleTimeString()}
            </span>
            {timeSinceActive !== null && (
              <span>
                Last active: {timeSinceActive < 60 ? `${timeSinceActive}m ago` : `${Math.floor(timeSinceActive / 60)}h ago`}
              </span>
            )}
            <span>
              Interactions: {agent.memory.totalInteractions}
            </span>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${STATE_COLORS[agent.lifecycle]}`} />
      </div>
    </div>
  );
}
