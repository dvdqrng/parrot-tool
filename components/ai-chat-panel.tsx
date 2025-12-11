'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, X, Copy, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadSettings } from '@/lib/storage';
import { toast } from 'sonner';

// Parse message content to extract draft sections
type ContentPart = { type: 'text'; content: string } | { type: 'draft'; content: string };

function parseMessageContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const draftRegex = /<draft>([\s\S]*?)<\/draft>/g;
  let lastIndex = 0;
  let match;

  while ((match = draftRegex.exec(content)) !== null) {
    // Add text before the draft
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        parts.push({ type: 'text', content: text });
      }
    }
    // Add the draft
    parts.push({ type: 'draft', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last draft
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      parts.push({ type: 'text', content: text });
    }
  }

  // If no drafts found, return the whole content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return parts;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messageContext: string;
  senderName: string;
  onUseDraft?: (draft: string) => void;
  messages: AiChatMessage[];
  onMessagesChange: (messages: AiChatMessage[]) => void;
}

export function AiChatPanel({
  isOpen,
  onClose,
  messageContext,
  senderName,
  onUseDraft,
  messages,
  onMessagesChange,
}: AiChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear chat history
  const handleClearChat = useCallback(() => {
    onMessagesChange([]);
  }, [onMessagesChange]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const settings = loadSettings();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey) {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messageContext,
          senderName,
          chatHistory: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          userMessage: userMessage.content,
        }),
      });

      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const assistantMessage: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.data.response,
      };

      onMessagesChange([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messageContext, senderName, messages, onMessagesChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleUseDraft = useCallback((content: string) => {
    onUseDraft?.(content);
    toast.success('Draft applied to reply');
  }, [onUseDraft]);

  return (
    <div
      className={cn(
        'h-full bg-white rounded-2xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
        isOpen ? 'w-96' : 'w-0'
      )}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
            <div className="flex items-center gap-2">
              <span className="font-medium">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat messages */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <p>Ask me anything about this conversation.</p>
                  <p className="mt-2">I can help you:</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>Draft a reply</li>
                    <li>Summarize the conversation</li>
                    <li>Suggest talking points</li>
                    <li>Brainstorm ideas</li>
                  </ul>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col',
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    )}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-[90%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-2">
                        {parseMessageContent(msg.content).map((part, idx) => (
                          <div key={idx}>
                            {part.type === 'text' ? (
                              <div className="rounded-2xl px-4 py-2 bg-muted">
                                <p className="text-sm whitespace-pre-wrap">{part.content}</p>
                              </div>
                            ) : (
                              <div className="border rounded-xl overflow-hidden">
                                <div className="px-4 py-2 bg-muted/50">
                                  <p className="text-sm whitespace-pre-wrap">{part.content}</p>
                                </div>
                                {onUseDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-none border-t"
                                    onClick={() => handleUseDraft(part.content)}
                                  >
                                    Use as draft
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex gap-1 px-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy(msg.id, msg.content.replace(/<\/?draft>/g, ''))}
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            {copiedId === msg.id ? 'Copied' : 'Copy all'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator className="shrink-0" />

          {/* Input area */}
          <div className="shrink-0 p-4 space-y-2">
            <Textarea
              ref={inputRef}
              placeholder="Ask about this conversation..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] resize-none"
              disabled={isLoading}
            />
            <Button
              className="w-full"
              onClick={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
