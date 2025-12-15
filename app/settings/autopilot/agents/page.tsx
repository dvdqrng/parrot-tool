'use client';

import Link from 'next/link';
import { Plus, Brain, MoreVertical, Copy, Trash2, Pencil, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAutopilotAgents } from '@/hooks/use-autopilot-agents';
import { AutopilotAgent } from '@/lib/types';
import { useState } from 'react';

function getGoalCompletionLabel(behavior: AutopilotAgent['goalCompletionBehavior']): string {
  switch (behavior) {
    case 'auto-disable': return 'Auto-disable';
    case 'maintenance': return 'Maintenance mode';
    case 'handoff': return 'Handoff';
    default: return behavior;
  }
}

export default function AgentsListPage() {
  const { agents, isLoaded, deleteAgent, duplicateAgent } = useAutopilotAgents();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AutopilotAgent | null>(null);

  const handleDelete = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDuplicate = (agent: AutopilotAgent) => {
    duplicateAgent(agent.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Autopilot Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage AI agents for automated conversations.
          </p>
        </div>
        <Link href="/settings/autopilot/agents/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
            New Agent
          </Button>
        </Link>
      </div>

      {!isLoaded ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Brain className="h-4 w-4 mx-auto text-muted-foreground mb-4" strokeWidth={1.5} />
            <h3 className="font-medium mb-2">No agents created yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Agents are AI assistants that can automatically reply to messages
              with specific goals like scheduling meetings or casual conversation.
            </p>
            <Link href="/settings/autopilot/agents/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Create Your First Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Brain className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {agent.description}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/settings/autopilot/agents/${agent.id}`}>
                        <DropdownMenuItem>
                          <Pencil className="h-4 w-4 mr-2" strokeWidth={1.5} />
                          Edit
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={() => handleDuplicate(agent)}>
                        <Copy className="h-4 w-4 mr-2" strokeWidth={1.5} />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setAgentToDelete(agent);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" strokeWidth={1.5} />
                    <span className="truncate max-w-[150px]">{agent.goal}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" strokeWidth={1.5} />
                    <span>{agent.behavior.replyDelayMin}-{agent.behavior.replyDelayMax}s delay</span>
                  </div>
                  <div className="text-xs bg-muted px-2 py-0.5 rounded">
                    {getGoalCompletionLabel(agent.goalCompletionBehavior)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{agentToDelete?.name}&quot;? This action cannot be undone.
              Any chats using this agent will have autopilot disabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
