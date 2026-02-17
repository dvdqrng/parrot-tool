'use client';

/**
 * Metrics Dashboard
 * Display collected metrics for the intelligence layer
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IntelligenceMetrics,
  getIntelligenceMetrics,
  resetMetrics,
} from '@/lib/intelligence/instrumentation/metrics';
import {
  RefreshCw,
  FileText,
  Bot,
  Zap,
  DollarSign,
  Clock,
  Share2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<IntelligenceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getIntelligenceMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const handleReset = () => {
    if (confirm('Reset all metrics? This cannot be undone.')) {
      resetMetrics();
      loadMetrics();
    }
  };

  if (isLoading && !metrics) {
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

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No metrics available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Metrics Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Period: {new Date(metrics.period.start).toLocaleString()} -{' '}
            {new Date(metrics.period.end).toLocaleString()} (
            {metrics.period.durationHours.toFixed(1)}h)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={loadMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={<FileText className="w-4 h-4" />}
          label="Drafts Generated"
          value={metrics.drafts.generated}
          subvalue={`${(metrics.drafts.acceptanceRate * 100).toFixed(0)}% accepted`}
        />
        <MetricCard
          icon={<Bot className="w-4 h-4" />}
          label="Agents Active"
          value={metrics.agents.spawned}
          subvalue={`${(metrics.agents.reuseRate * 100).toFixed(0)}% reuse rate`}
        />
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Facts Extracted"
          value={metrics.extraction.factsExtracted}
          subvalue={`${(metrics.extraction.factEditRate * 100).toFixed(0)}% edited`}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Est. Daily Cost"
          value={`$${metrics.cost.estimatedDailyUsd.toFixed(2)}`}
          subvalue={`${metrics.cost.apiCalls} API calls`}
        />
      </div>

      <Tabs defaultValue="drafts" className="w-full">
        <TabsList>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="extraction">Extraction</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts">
          <DraftsPanel metrics={metrics} />
        </TabsContent>

        <TabsContent value="extraction">
          <ExtractionPanel metrics={metrics} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsPanel metrics={metrics} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformancePanel metrics={metrics} />
        </TabsContent>

        <TabsContent value="cost">
          <CostPanel metrics={metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// METRIC CARD
// ============================================

function MetricCard({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subvalue?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subvalue && (
          <div className="text-xs text-muted-foreground mt-1">{subvalue}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// DRAFTS PANEL
// ============================================

function DraftsPanel({ metrics }: { metrics: IntelligenceMetrics }) {
  const { drafts } = metrics;
  const total = drafts.generated || 1;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Draft Quality Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{drafts.generated}</div>
            <div className="text-xs text-muted-foreground">Generated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{drafts.accepted}</div>
            <div className="text-xs text-muted-foreground">Accepted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{drafts.edited}</div>
            <div className="text-xs text-muted-foreground">Edited</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{drafts.rejected}</div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Acceptance Rate</span>
            <span>{(drafts.acceptanceRate * 100).toFixed(1)}%</span>
          </div>
          <Progress value={drafts.acceptanceRate * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Edit Distribution</div>
          <div className="flex gap-2">
            <Badge variant="outline">
              No edits: {drafts.editRate.noEdits}
            </Badge>
            <Badge variant="outline">
              Minor: {drafts.editRate.minorEdits}
            </Badge>
            <Badge variant="outline">
              Major: {drafts.editRate.majorEdits}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EXTRACTION PANEL
// ============================================

function ExtractionPanel({ metrics }: { metrics: IntelligenceMetrics }) {
  const { extraction } = metrics;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Extraction Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-2xl font-bold">{extraction.tier1Runs}</div>
            <div className="text-xs text-muted-foreground">Tier 1 (Local)</div>
          </div>
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-2xl font-bold">{extraction.tier2Runs}</div>
            <div className="text-xs text-muted-foreground">Tier 2 (LLM)</div>
          </div>
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-2xl font-bold">{extraction.tier3Runs}</div>
            <div className="text-xs text-muted-foreground">Tier 3 (Deep)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Facts Extracted</span>
              <span>{extraction.factsExtracted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Facts Edited</span>
              <span>{extraction.factsEdited}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Edit Rate</span>
              <span>{(extraction.factEditRate * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Contradictions Detected</span>
              <span>{extraction.contradictionsDetected}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Contradictions Resolved</span>
              <span>{extraction.contradictionsResolved}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// AGENTS PANEL
// ============================================

function AgentsPanel({ metrics }: { metrics: IntelligenceMetrics }) {
  const { agents } = metrics;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Agent Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold">{agents.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold">{agents.warm}</div>
            <div className="text-xs text-muted-foreground">Warm</div>
          </div>
          <div className="text-center p-2 rounded bg-blue-500/10">
            <div className="text-lg font-bold">{agents.cool}</div>
            <div className="text-xs text-muted-foreground">Cool</div>
          </div>
          <div className="text-center p-2 rounded bg-slate-500/10">
            <div className="text-lg font-bold">{agents.dormant}</div>
            <div className="text-xs text-muted-foreground">Dormant</div>
          </div>
          <div className="text-center p-2 rounded bg-muted">
            <div className="text-lg font-bold">{agents.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Spawned</div>
            <div className="text-xl font-bold">{agents.spawned}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Reused</div>
            <div className="text-xl font-bold">{agents.reused}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Reuse Rate</div>
            <div className="text-xl font-bold">
              {(agents.reuseRate * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Avg Response Time</span>
            <span>{agents.avgResponseTimeMs.toFixed(0)}ms</span>
          </div>
          <Progress
            value={Math.min(agents.avgResponseTimeMs / 50, 100)}
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// PERFORMANCE PANEL
// ============================================

function PerformancePanel({ metrics }: { metrics: IntelligenceMetrics }) {
  const { performance, crossChat } = metrics;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Avg Init Time</span>
            </div>
            <div className="text-xl font-bold">{performance.avgInitTimeMs.toFixed(0)}ms</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Avg Query Time</span>
            </div>
            <div className="text-xl font-bold">{performance.avgQueryTimeMs.toFixed(0)}ms</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Share2 className="w-4 h-4" />
              <span>Store Size</span>
            </div>
            <div className="text-xl font-bold">{performance.storeSizeKb.toFixed(0)}KB</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3">Cross-Chat Intelligence</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Facts Used</div>
              <div className="text-xl font-bold">{crossChat.factsUsedAcrossChats}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">User State Usage</div>
              <div className="text-xl font-bold">
                {(crossChat.userStateUsageRate * 100).toFixed(0)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Context Sharing</div>
              <div className="text-xl font-bold">{crossChat.contextSharing}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COST PANEL
// ============================================

function CostPanel({ metrics }: { metrics: IntelligenceMetrics }) {
  const { cost } = metrics;
  const totalTokens = cost.tokensUsed.input + cost.tokensUsed.output;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Cost Tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-green-600">
            ${cost.estimatedDailyUsd.toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">Estimated Daily Cost</div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-xl font-bold">{cost.apiCalls}</div>
            <div className="text-xs text-muted-foreground">API Calls</div>
          </div>
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-xl font-bold">
              {(cost.tokensUsed.input / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-muted-foreground">Input Tokens</div>
          </div>
          <div className="text-center p-3 rounded bg-muted/50">
            <div className="text-xl font-bold">
              {(cost.tokensUsed.output / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-muted-foreground">Output Tokens</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Token Distribution</span>
            <span>
              {totalTokens > 0
                ? `${((cost.tokensUsed.input / totalTokens) * 100).toFixed(0)}% in / ${((cost.tokensUsed.output / totalTokens) * 100).toFixed(0)}% out`
                : 'N/A'}
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="bg-blue-500"
              style={{
                width: totalTokens > 0
                  ? `${(cost.tokensUsed.input / totalTokens) * 100}%`
                  : '0%',
              }}
            />
            <div
              className="bg-purple-500"
              style={{
                width: totalTokens > 0
                  ? `${(cost.tokensUsed.output / totalTokens) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Cost estimate based on $3/M input tokens, $15/M output tokens
        </div>
      </CardContent>
    </Card>
  );
}
