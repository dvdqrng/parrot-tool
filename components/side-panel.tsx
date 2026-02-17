'use client';

/**
 * Shared Side Panel Component
 *
 * A unified panel shell that can display either Contact Profile or AI Chat content.
 * The panel has consistent styling and switches content based on the active tab.
 */

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SidePanelTab = 'contact' | 'ai-chat';

interface SidePanelProps {
  isOpen: boolean;
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onClose: () => void;
  // Content for each tab
  contactContent: ReactNode;
  aiChatContent: ReactNode;
  // Optional: show tab buttons (if AI is enabled)
  showAiTab?: boolean;
  className?: string;
}

export function SidePanel({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  contactContent,
  aiChatContent,
  showAiTab = false,
  className,
}: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'h-full w-96 bg-card rounded-2xl flex flex-col overflow-hidden shadow-lg dark:border shrink-0',
        className
      )}
    >
      {/* Header with tab buttons */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
        <div className="flex items-center gap-1">
          {/* Contact tab button */}
          <Button
            variant={activeTab === 'contact' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('contact')}
            className="h-8 px-3"
          >
            <User className="h-4 w-4 mr-2" strokeWidth={2} />
            Contact
          </Button>

          {/* AI Chat tab button - only show if AI is enabled */}
          {showAiTab && (
            <Button
              variant={activeTab === 'ai-chat' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onTabChange('ai-chat')}
              className="h-8 px-3"
            >
              <MessageSquare className="h-4 w-4 mr-2" strokeWidth={2} />
              AI Chat
            </Button>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      {/* Content area - switch based on active tab */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'contact' ? contactContent : aiChatContent}
      </div>
    </div>
  );
}
