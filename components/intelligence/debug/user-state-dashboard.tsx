'use client';

/**
 * User State Dashboard
 * Visual display of UserIntelligence for debugging and monitoring
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserIntelligence,
  ActiveContext,
  TopicCluster,
  DistributedInfoItem,
  CanonicalExplanation,
} from '@/lib/intelligence/user-state/types';
import { userStateStore } from '@/lib/intelligence/knowledge/store';
import {
  RefreshCw,
  Clock,
  Users,
  MessageSquare,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

export function UserStateDashboard() {
  const [userState, setUserState] = useState<UserIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserState = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const state = await userStateStore.get();
      setUserState(state || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user state');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserState();
  }, []);

  if (isLoading) {
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

  if (!userState) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No user state found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">User State Dashboard</h2>
        <Button variant="outline" size="sm" onClick={loadUserState}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Active Contexts"
          value={userState.activeContexts?.length || 0}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Active Topics"
          value={userState.activeTopics?.length || 0}
        />
        <StatCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Distributed Info"
          value={userState.distributedInfo?.length || 0}
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Canonical Explanations"
          value={userState.canonicalExplanations?.length || 0}
        />
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="contexts" className="w-full">
        <TabsList>
          <TabsTrigger value="contexts">Active Contexts</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="distributed">Distributed Info</TabsTrigger>
          <TabsTrigger value="explanations">Explanations</TabsTrigger>
        </TabsList>

        <TabsContent value="contexts">
          <ActiveContextsPanel contexts={userState.activeContexts || []} />
        </TabsContent>

        <TabsContent value="topics">
          <TopicsPanel topics={userState.activeTopics || []} />
        </TabsContent>

        <TabsContent value="distributed">
          <DistributedInfoPanel info={userState.distributedInfo || []} />
        </TabsContent>

        <TabsContent value="explanations">
          <CanonicalExplanationsPanel
            explanations={userState.canonicalExplanations || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ============================================
// ACTIVE CONTEXTS PANEL
// ============================================

function ActiveContextsPanel({ contexts }: { contexts: ActiveContext[] }) {
  if (contexts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No active contexts
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {contexts.map((context) => (
          <Card key={context.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{context.label}</CardTitle>
                <Badge variant={context.status === 'active' ? 'default' : 'secondary'}>
                  {context.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">First detected:</span>{' '}
                  {new Date(context.firstDetected).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Updated:</span>{' '}
                  {new Date(context.lastUpdated).toLocaleString()}
                </div>
                {context.autoExpiry && (
                  <div>
                    <span className="font-medium">Auto-expires:</span>{' '}
                    {new Date(context.autoExpiry).toLocaleString()}
                  </div>
                )}
                <div>
                  <span className="font-medium">Contacts:</span>{' '}
                  {context.relatedContacts.length}
                </div>
              </div>
              {context.keyFacts && context.keyFacts.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="font-medium text-muted-foreground">Key Facts:</span>
                  <ul className="mt-1 list-disc list-inside">
                    {context.keyFacts.slice(0, 3).map((fact, i) => (
                      <li key={i} className="truncate">
                        {fact.label}: {fact.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================
// TOPICS PANEL
// ============================================

function TopicsPanel({ topics }: { topics: TopicCluster[] }) {
  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No active topics
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {topics.map((topic) => (
          <Card key={topic.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{topic.topic}</CardTitle>
                <Badge variant="secondary">
                  Frequency: {topic.frequency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-1 mb-2">
                {topic.keywords.slice(0, 5).map((keyword, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {topic.keywords.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{topic.keywords.length - 5} more
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">First mentioned:</span>{' '}
                {new Date(topic.firstMentioned).toLocaleDateString()}
                {' • '}
                <span className="font-medium">Last mentioned:</span>{' '}
                {new Date(topic.lastMentioned).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================
// DISTRIBUTED INFO PANEL
// ============================================

function DistributedInfoPanel({ info }: { info: DistributedInfoItem[] }) {
  if (info.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No distributed info
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {info.map((item) => (
          <Card key={item.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm truncate">{item.content}</CardTitle>
                <Badge variant="outline">{item.sharedWith.length} recipients</Badge>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-xs text-muted-foreground mb-2">
                <span className="font-medium">First shared:</span>{' '}
                {new Date(item.firstShared).toLocaleDateString()}
                {' • '}
                <span className="font-medium">Last shared:</span>{' '}
                {new Date(item.lastShared).toLocaleDateString()}
              </div>
              {item.variations && item.variations.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-muted-foreground">Variations:</span>
                  <ul className="mt-1 list-disc list-inside">
                    {item.variations.slice(0, 2).map((v, i) => (
                      <li key={i} className="truncate">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================
// CANONICAL EXPLANATIONS PANEL
// ============================================

function CanonicalExplanationsPanel({
  explanations,
}: {
  explanations: CanonicalExplanation[];
}) {
  if (explanations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No canonical explanations
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {explanations.map((exp) => (
          <Card key={exp.id}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{exp.topic}</CardTitle>
                <Badge variant="secondary">Used {exp.frequency}x</Badge>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-sm mb-2 p-2 bg-muted rounded">
                {exp.shortVersion}
              </div>
              {exp.longVersion && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Full version available</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
