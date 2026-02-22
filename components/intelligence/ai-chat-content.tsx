'use client';

/**
 * AI Chat Content
 *
 * The inner content of the AI chat panel, without the outer shell.
 * Used inside the shared SidePanel component.
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
import type { CompanionMessage, CompanionSuggestion, QuickAction } from './ai-companion-panel';

// ============================================
// INTERNAL COMPONENTS
// ============================================

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

function AssistantMessage({
  message,
  onApplyDraft,
  onDismiss,
  onSuggestionClick,
}: {
  message: CompanionMessage;
  onApplyDraft?: (draft: string) => void;
  onDismiss?: () => void;
  onSuggestionClick?: (suggestion: CompanionSuggestion) => void;
}) {
  const isDraft = message.type === 'draft' && message.metadata?.draftText;
  const isInsight = message.type === 'insight';
  const isAction = message.type === 'action';
  const suggestions = message.metadata?.suggestions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-start w-full"
    >
      <div className="bg-muted rounded-2xl px-4 py-2 max-w-[85%] space-y-2 overflow-hidden">
        <p className="text-xs whitespace-pre-wrap break-words">{message.content}</p>

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

        {/* Suggestion buttons */}
        {suggestions && suggestions.length > 0 && !message.metadata?.dismissed && (
          <div className="flex flex-col gap-1.5 pt-1">
            {suggestions.map((sug) => (
              <button
                key={sug.id}
                className="flex items-start gap-2 w-full text-left text-xs px-2.5 py-2 rounded-lg border bg-background hover:bg-accent transition-colors"
                onClick={() => onSuggestionClick?.(sug)}
              >
                <span className="shrink-0 mt-0.5">
                  {sug.type === 'share_link' && (
                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                  {sug.type === 'draft' && (
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  {sug.type === 'send_message' && (
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </span>
                <span className="break-words">{sug.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Insight actions (only show "Got it" if no suggestions) */}
        {isInsight && !message.metadata?.dismissed && (!suggestions || suggestions.length === 0) && (
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onDismiss}>
            Got it
          </Button>
        )}

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

interface AiChatContentProps {
  messages: CompanionMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onApplyDraft?: (draft: string) => void;
  onDismissInsight?: (messageId: string) => void;
  onSuggestionClick?: (suggestion: CompanionSuggestion) => void;
  isLoading?: boolean;
  isThinking?: boolean;
  chatId?: string;
  quickActions?: QuickAction[];
  error?: string | null;
  onClearError?: () => void;
}

export function AiChatContent({
  messages,
  onSendMessage,
  onApplyDraft,
  onDismissInsight,
  onSuggestionClick,
  isLoading = false,
  isThinking = false,
  chatId,
  quickActions = [],
  error,
  onClearError,
}: AiChatContentProps) {
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

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    try {
      await onSendMessage(message);
    } catch (err) {
      console.error('[AiChatContent] Error sending message:', err);
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

  // Default quick actions
  const defaultQuickActions: QuickAction[] = [
    {
      id: 'draft',
      label: 'Draft Reply',
      icon: <FileText className="w-4 h-4" />,
      action: () => onSendMessage('Help me draft a reply'),
    },
    {
      id: 'summarize',
      label: 'Summarize',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => onSendMessage('Summarize this conversation'),
    },
    {
      id: 'remind',
      label: 'Set Reminder',
      icon: <Clock className="w-4 h-4" />,
      action: () => onSendMessage('Help me set a reminder about this chat'),
    },
  ];

  const actionsToShow = quickActions.length > 0 ? quickActions : defaultQuickActions;

  // Check for API key
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const hasKey = checkHasApiKey();
    setHasApiKey(hasKey);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Error Banner */}
      <AnimatePresence>
        {error && <ErrorBanner error={error} onDismiss={onClearError} />}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]]:!overflow-x-hidden" ref={scrollRef}>
        <div className="p-4 space-y-3 w-full overflow-hidden">
          {/* API Key Warning */}
          {!hasApiKey && (
            <div className="flex flex-col items-center justify-center py-4 text-center bg-muted rounded-lg p-4">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mb-3">
                <Key className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-xs font-medium mb-1">API Key Required</h3>
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

          {/* Welcome message */}
          {messages.length === 0 && hasApiKey && !isThinking && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-xs font-medium mb-2">Analyzing conversation...</h3>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                I&apos;ll help you with insights and draft suggestions.
              </p>
            </div>
          )}

          {/* Message list */}
          <AnimatePresence mode="popLayout">
            {messages.length > 0 &&
              messages.map((msg) => {
                if (msg.metadata?.dismissed) return null;
                if (msg.role === 'assistant') {
                  return (
                    <AssistantMessage
                      key={msg.id}
                      message={msg}
                      onApplyDraft={onApplyDraft}
                      onDismiss={() => onDismissInsight?.(msg.id)}
                      onSuggestionClick={onSuggestionClick}
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

      {/* Quick actions */}
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

      {/* AI Stream of Consciousness */}
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
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
