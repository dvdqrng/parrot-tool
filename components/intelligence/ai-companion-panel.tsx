'use client';

/**
 * AI Companion Panel
 * A PROACTIVE conversational interface that:
 * - Automatically analyzes conversations when opened
 * - Suggests drafts without being asked
 * - Surfaces insights and action items
 * - Acts like a helpful assistant, not just a chatbot
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Loader2,
  MessageSquare,
  FileText,
  Clock,
  X,
  AlertTriangle,
  Key,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasApiKey as checkHasApiKey } from '@/lib/intelligence-settings';
import { StreamOfConsciousness } from './stream-of-consciousness';

// ============================================
// TYPES
// ============================================

export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'chat' | 'draft' | 'insight' | 'action';
  metadata?: {
    draftText?: string;
    confidence?: number;
    actionType?: string;
    urgency?: string;
    mood?: string;
    dismissed?: boolean;
    reasoning?: string;
  };
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  variant?: 'default' | 'secondary' | 'outline';
}

interface AiCompanionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: CompanionMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onApplyDraft?: (draft: string) => void;
  onDismissInsight?: (messageId: string) => void;
  isLoading?: boolean;
  isThinking?: boolean;
  chatId?: string;
  quickActions?: QuickAction[];
  error?: string | null;
  onClearError?: () => void;
  className?: string;
}

// Error display component
function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2"
    >
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-xs text-destructive font-medium">Error</p>
        <p className="text-xs text-destructive/80">{error}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </motion.div>
  );
}

// ============================================
// MESSAGE COMPONENTS
// ============================================

function AssistantMessage({
  message,
  onApplyDraft,
  onDismiss,
}: {
  message: CompanionMessage;
  onApplyDraft?: (draft: string) => void;
  onDismiss?: () => void;
}) {
  const isDraft = message.type === 'draft' && message.metadata?.draftText;
  const isInsight = message.type === 'insight';
  const isAction = message.type === 'action';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-start"
    >
      <div className="bg-muted rounded-2xl px-4 py-2 max-w-[85%] space-y-2">
        <p className="text-xs whitespace-pre-wrap">{message.content}</p>

        {/* Draft preview and actions */}
        {isDraft && message.metadata?.draftText && (
          <div className="bg-background rounded-lg p-2 space-y-2">
            <p className="text-xs font-medium">
              &ldquo;{message.metadata.draftText}&rdquo;
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onApplyDraft?.(message.metadata!.draftText!)}
              >
                Use Draft
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Insight actions */}
        {isInsight && !message.metadata?.dismissed && (
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onDismiss}>
            Got it
          </Button>
        )}

        {/* Action confirmation */}
        {isAction && !message.metadata?.dismissed && (
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onDismiss}>
            Acknowledge
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function UserMessage({ message }: { message: CompanionMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-end"
    >
      <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[85%]">
        <p className="text-xs">{message.content}</p>
      </div>
    </motion.div>
  );
}

function SystemMessage({ message }: { message: CompanionMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-center"
    >
      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
        {message.content}
      </span>
    </motion.div>
  );
}

// Thinking indicator with animation
function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-start"
    >
      <div className="bg-muted rounded-2xl px-4 py-2 flex items-center gap-2">
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Thinking...</span>
      </div>
    </motion.div>
  );
}

// ============================================
// AI STREAM SECTION (Collapsible)
// ============================================

function AIStreamSection({ chatId }: { chatId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="shrink-0 border-t">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3" strokeWidth={2} />
          <span>Activity Log</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" strokeWidth={2} />
        ) : (
          <ChevronUp className="w-3 h-3" strokeWidth={2} />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 150, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <StreamOfConsciousness
              maxEntries={20}
              showControls={false}
              className="h-[150px]"
              chatId={chatId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AiCompanionPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onApplyDraft,
  onDismissInsight,
  isLoading = false,
  isThinking = false,
  chatId,
  quickActions = [],
  error,
  onClearError,
  className,
}: AiCompanionPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    console.log(
      '[AiCompanionPanel] handleSend called, input:',
      input,
      'isLoading:',
      isLoading
    );
    if (!input.trim() || isLoading) {
      console.log('[AiCompanionPanel] Skipping send - empty or loading');
      return;
    }

    const message = input.trim();
    console.log('[AiCompanionPanel] Sending message:', message);
    setInput('');
    try {
      await onSendMessage(message);
      console.log('[AiCompanionPanel] Message sent successfully');
    } catch (err) {
      console.error('[AiCompanionPanel] Error sending message:', err);
    }
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Default quick actions if none provided
  const defaultQuickActions: QuickAction[] = [
    {
      id: 'draft',
      label: 'Draft Reply',
      icon: <FileText className="w-4 h-4" />,
      action: () => {
        console.log('[AiCompanionPanel] Quick action: Draft Reply clicked');
        onSendMessage('Help me draft a reply');
      },
    },
    {
      id: 'summarize',
      label: 'Summarize',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => {
        console.log('[AiCompanionPanel] Quick action: Summarize clicked');
        onSendMessage('Summarize this conversation');
      },
    },
    {
      id: 'remind',
      label: 'Set Reminder',
      icon: <Clock className="w-4 h-4" />,
      action: () => {
        console.log('[AiCompanionPanel] Quick action: Set Reminder clicked');
        onSendMessage('Help me set a reminder about this chat');
      },
    },
  ];

  const actionsToShow =
    quickActions.length > 0 ? quickActions : defaultQuickActions;

  // Check for API key - re-check every time panel opens
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const hasKey = checkHasApiKey();
      console.log('[AiCompanionPanel] Checking API key, hasKey:', hasKey);
      setHasApiKey(hasKey);
    }
  }, [isOpen]);

  console.log(
    '[AiCompanionPanel] Rendering, isOpen:',
    isOpen,
    'hasApiKey:',
    hasApiKey,
    'messages:',
    messages.length
  );

  // Early return if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'h-full bg-card rounded-2xl flex flex-col overflow-hidden shadow-lg border',
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
        <span className="text-xs font-medium">AI Chat</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && <ErrorBanner error={error} onDismiss={onClearError} />}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {/* API Key Warning */}
          {!hasApiKey && (
            <div className="flex flex-col items-center justify-center py-4 text-center bg-muted rounded-lg p-4">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mb-3">
                <Key className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-xs font-medium mb-1">
                API Key Required
              </h3>
              <p className="text-xs text-muted-foreground max-w-[220px] mb-3">
                Add your API key to enable AI features.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => (window.location.href = '/settings/intelligence')}
              >
                Go to Settings
              </Button>
            </div>
          )}

          {/* Welcome message when API key exists but no messages yet and not thinking */}
          {messages.length === 0 && hasApiKey && !isThinking && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-xs font-medium mb-2">
                Analyzing conversation...
              </h3>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                I&apos;ll help you with insights and draft suggestions.
              </p>
            </div>
          )}

          {/* Message list */}
          <AnimatePresence mode="popLayout">
            {messages.length > 0 &&
              messages.map((msg) => {
                if (msg.metadata?.dismissed) {
                  return null;
                }
                if (msg.role === 'assistant') {
                  return (
                    <AssistantMessage
                      key={msg.id}
                      message={msg}
                      onApplyDraft={onApplyDraft}
                      onDismiss={() => onDismissInsight?.(msg.id)}
                    />
                  );
                } else if (msg.role === 'user') {
                  return <UserMessage key={msg.id} message={msg} />;
                } else {
                  return <SystemMessage key={msg.id} message={msg} />;
                }
              })}
          </AnimatePresence>

          {/* Thinking indicator */}
          <AnimatePresence>{isThinking && <ThinkingIndicator />}</AnimatePresence>
        </div>
      </ScrollArea>

      {/* Quick actions - only show when no messages and not thinking */}
      {messages.length === 0 && hasApiKey && !isThinking && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {actionsToShow.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.action}
                disabled={isLoading || isThinking}
                className="text-xs"
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* AI Stream of Consciousness - collapsible */}
      {hasApiKey && <AIStreamSection chatId={chatId} />}

      {/* Input */}
      <div className="shrink-0 p-4">
        <div className="flex items-center gap-3 bg-muted rounded-full px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? 'Message...' : 'Add API key first'}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            disabled={isLoading || !hasApiKey}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !hasApiKey}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0',
              input.trim() && hasApiKey && !isLoading
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted-foreground/20 text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
