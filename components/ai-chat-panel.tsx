'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X, Copy, Check, Trash2, Plus, Mic, MicOff, Volume2, Square, Paperclip, Image, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadSettings } from '@/lib/storage';
import { toast } from 'sonner';

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

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
      if (settings.anthropicApiKey && settings.aiProvider !== 'ollama') {
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
          // Provider settings
          provider: settings.aiProvider || 'anthropic',
          ollamaModel: settings.ollamaModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
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

  // File attachment handlers
  const handleFileSelect = useCallback((type: 'file' | 'image') => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : '*/*';
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setAttachments(prev => [...prev, ...newFiles]);
      toast.success(`Added ${newFiles.length} file(s)`);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Audio recording (voice-to-text) handlers
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Use Web Speech API for transcription
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          toast.info('Processing speech...');
        } else {
          // Fallback: just notify that the audio was recorded
          toast.success('Audio recorded (speech-to-text requires browser support)');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Could not access microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Use Web Speech API for voice input
  const handleVoiceInput = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }

    // Check for SpeechRecognition support
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? ' ' : '') + transcript);
      toast.success('Speech captured');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      toast.error(`Speech error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, [isRecording, stopRecording]);

  // Text-to-speech handler
  const handleTextToSpeech = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech not supported in this browser');
      return;
    }

    // If already speaking, stop
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error('Text-to-speech failed');
    };

    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking]);

  // Stop speech when panel closes
  useEffect(() => {
    if (!isOpen && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isOpen, isSpeaking]);

  return (
    <div
      className={cn(
        'h-full bg-card rounded-2xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-lg',
        isOpen ? 'w-96 dark:border' : 'w-0'
      )}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b h-[76px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          {/* Chat messages */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <p>Ask me anything about this conversation.</p>
                  <p className="mt-2">I can help you:</p>
                  <ul className="mt-2 space-y-1">
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
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-2">
                        {parseMessageContent(msg.content).map((part, idx) => (
                          <div key={idx}>
                            {part.type === 'text' ? (
                              <div className="rounded-2xl px-4 py-2 bg-muted">
                                <p className="text-xs whitespace-pre-wrap">{part.content}</p>
                              </div>
                            ) : (
                              <div className="border rounded-xl overflow-hidden">
                                <div className="px-4 py-2 bg-muted/50">
                                  <p className="text-xs whitespace-pre-wrap">{part.content}</p>
                                </div>
                                {onUseDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-none border-t"
                                    onClick={() => handleUseDraft(part.content)}
                                  >
                                    <span className="text-xs">Use as draft</span>
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
                              <Check className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            )}
                            <span className="text-xs">{copiedId === msg.id ? 'Copied' : 'Copy all'}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-6 px-2 text-xs text-muted-foreground hover:text-foreground",
                              isSpeaking && "text-primary"
                            )}
                            onClick={() => handleTextToSpeech(msg.content.replace(/<\/?draft>/g, ''))}
                            title={isSpeaking ? "Stop speaking" : "Read aloud"}
                          >
                            {isSpeaking ? (
                              <Square className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            ) : (
                              <Volume2 className="h-4 w-4 mr-1" strokeWidth={1.5} />
                            )}
                            <span className="text-xs">{isSpeaking ? 'Stop' : 'Listen'}</span>
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
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            multiple
          />

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="shrink-0 px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-full bg-muted px-3 py-1"
                  >
                    <span className="max-w-[100px] truncate text-xs">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="shrink-0 p-4 pt-2">
            {/* Attachment menu */}
            {showAttachMenu && (
              <div className="mb-2 flex gap-2 rounded-lg border bg-background p-2 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleFileSelect('file')}
                >
                  <Paperclip className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  File
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleFileSelect('image')}
                >
                  <Image className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Image
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full",
                  showAttachMenu && "bg-muted"
                )}
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                disabled={isLoading}
              >
                <Plus className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showAttachMenu && "rotate-45"
                )} strokeWidth={1.5} />
              </Button>
              <Input
                ref={inputRef}
                type="text"
                placeholder="Ask anything"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 h-8"
                disabled={isLoading}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full",
                  isRecording && "bg-red-100 text-red-600 hover:bg-red-200"
                )}
                onClick={handleVoiceInput}
                disabled={isLoading}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Mic className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={sendMessage}
                disabled={!inputText.trim() || isLoading}
                title="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Send className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
