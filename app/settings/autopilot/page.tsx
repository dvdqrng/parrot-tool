'use client';

import Link from 'next/link';
import { Brain, Plus, Settings, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { getActiveAutopilotChats } from '@/lib/storage';
import { useEffect, useState } from 'react';

export default function AutopilotSettingsPage() {
  const { agents, isLoaded } = useAutopilotAgents();
  const [activeChatsCount, setActiveChatsCount] = useState(0);

  useEffect(() => {
    const activeChats = getActiveAutopilotChats();
    setActiveChatsCount(activeChats.length);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4" strokeWidth={1.5} />
          Autopilot
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI agents that automatically reply to messages on your behalf.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoaded ? agents.length : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Chats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeChatsCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Actions */}
      <div className="space-y-3">
        <Link href="/settings/autopilot/agents">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Settings className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Manage Agents</CardTitle>
                    <CardDescription className="text-xs">
                      Create, edit, and configure autopilot agents
                    </CardDescription>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isLoaded ? `${agents.length} agent${agents.length !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/autopilot/activity">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-sm">Activity Log</CardTitle>
                  <CardDescription className="text-xs">
                    View autopilot actions and message history
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Quick Create */}
      {agents.length === 0 && isLoaded && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Brain className="h-4 w-4 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
            <h3 className="font-medium mb-1">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first autopilot agent to start automating conversations.
            </p>
            <Link href="/settings/autopilot/agents/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How Autopilot Works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>1. Create Agents:</strong> Define AI agents with specific goals like
            &quot;schedule a meeting&quot; or &quot;casual conversation&quot;.
          </p>
          <p>
            <strong>2. Activate per Chat:</strong> Enable autopilot on specific conversations
            and choose which agent to use.
          </p>
          <p>
            <strong>3. Choose Mode:</strong> Manual approval (review before sending) or
            self-driving (fully automatic with time limits).
          </p>
          <p>
            <strong>4. Human-like Behavior:</strong> Agents simulate realistic timing,
            typing indicators, and message patterns based on your writing style.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
