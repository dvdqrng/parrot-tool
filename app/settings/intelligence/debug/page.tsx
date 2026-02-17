'use client';

/**
 * Intelligence Debug Page
 * Access all debug dashboards for the intelligence layer
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  UserStateDashboard,
  KnowledgeExplorer,
  AgentRoster,
  MetricsDashboard,
} from '@/components/intelligence/debug';
import {
  Brain,
  Database,
  Bot,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

export default function IntelligenceDebugPage() {
  const [activeTab, setActiveTab] = useState('metrics');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Intelligence Debug
          </h1>
          <p className="text-muted-foreground">
            Monitor and debug the intelligence layer
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Debug Mode
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Debug Dashboards</CardTitle>
          <CardDescription>
            Select a dashboard to view detailed information about the intelligence layer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Knowledge
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="user-state" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                User State
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="metrics">
                <MetricsDashboard />
              </TabsContent>

              <TabsContent value="knowledge">
                <KnowledgeExplorer />
              </TabsContent>

              <TabsContent value="agents">
                <AgentRoster />
              </TabsContent>

              <TabsContent value="user-state">
                <UserStateDashboard />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
