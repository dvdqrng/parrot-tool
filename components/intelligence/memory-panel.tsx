'use client';

/**
 * Memory Panel
 * User-facing wrapper combining:
 * - "My Identity" (soul editor)
 * - "What AI Knows" (knowledge explorer)
 *
 * Intended for the settings page as a top-level section.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SoulEditor } from '@/components/intelligence/soul-editor';
import { KnowledgeExplorer } from '@/components/intelligence/debug/knowledge-explorer';
import { Brain, User, Database } from 'lucide-react';

export function MemoryPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Memory & Identity
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage what the AI knows about you and your contacts
        </p>
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="identity" className="text-xs gap-1.5">
            <User className="h-3 w-3" />
            My Identity
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5">
            <Database className="h-3 w-3" />
            What AI Knows
          </TabsTrigger>
        </TabsList>
        <TabsContent value="identity" className="mt-4">
          <SoulEditor />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
