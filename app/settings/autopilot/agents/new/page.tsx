'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AgentForm } from '@/components/autopilot/agent-form';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { AutopilotAgent } from '@/lib/types';

export default function NewAgentPage() {
  const router = useRouter();
  const { createAgent } = useAutopilotAgents();

  const handleSave = (data: Omit<AutopilotAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    createAgent(data);
    router.push('/settings/autopilot/agents');
  };

  const handleCancel = () => {
    router.push('/settings/autopilot/agents');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/autopilot/agents">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </Link>
        <div>
          <h2 className="text-lg font-semibold">Create Agent</h2>
          <p className="text-sm text-muted-foreground">
            Set up a new autopilot agent
          </p>
        </div>
      </div>

      <AgentForm onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}
