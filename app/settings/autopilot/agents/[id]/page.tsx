'use client';

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AgentForm } from '@/components/autopilot/agent-form';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { AutopilotAgent } from '@/lib/types';

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;
  const { agents, isLoaded, updateAgent, getAgentById } = useAutopilotAgents();
  const [agent, setAgent] = useState<AutopilotAgent | null>(null);

  useEffect(() => {
    if (isLoaded) {
      const found = getAgentById(agentId);
      if (found) {
        setAgent(found);
      } else {
        // Agent not found, redirect
        router.push('/settings/autopilot/agents');
      }
    }
  }, [isLoaded, agentId, getAgentById, router]);

  const handleSave = (data: Omit<AutopilotAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    updateAgent(agentId, data);
    router.push('/settings/autopilot/agents');
  };

  const handleCancel = () => {
    router.push('/settings/autopilot/agents');
  };

  if (!isLoaded || !agent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings/autopilot/agents">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold">Edit Agent</h2>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/autopilot/agents">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-semibold">Edit Agent</h2>
          <p className="text-sm text-muted-foreground">
            Modify {agent.name}
          </p>
        </div>
      </div>

      <AgentForm agent={agent} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
