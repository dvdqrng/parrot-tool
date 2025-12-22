'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadSettings } from '@/lib/storage';
import { getAIHeaders, getEffectiveAiProvider } from '@/lib/api-headers';
import { toast } from 'sonner';
import { AiChatMessage, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from './ai-chat-panel/types';
import { EmptyState } from './ai-chat-panel/empty-state';
import { UserMessage } from './ai-chat-panel/user-message';
import { AssistantMessage } from './ai-chat-panel/assistant-message';
import { AttachmentsPreview } from './ai-chat-panel/attachments-preview';
import { InputArea } from './ai-chat-panel/input-area';

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
      if (settings.anthropicApiKey && settings.aiProvider === 'anthropic') {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      } else if (settings.openaiApiKey && settings.aiProvider === 'openai') {
        headers['x-openai-key'] = settings.openaiApiKey;
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
          provider: getEffectiveAiProvider(settings),
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
      logger.error('Failed to send message:', error instanceof Error ? error : String(error));
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
      logger.error('Failed to start recording:', error instanceof Error ? error : String(error));
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
      logger.error('Speech recognition error:', event.error);
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
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
          </div>

          {/* Chat messages */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <EmptyState />
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
                      <UserMessage content={msg.content} />
                    ) : (
                      <AssistantMessage
                        messageId={msg.id}
                        content={msg.content}
                        onUseDraft={onUseDraft}
                        onCopy={handleCopy}
                        onSpeak={handleTextToSpeech}
                        copiedId={copiedId}
                        isSpeaking={isSpeaking}
                      />
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
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
          <AttachmentsPreview attachments={attachments} onRemove={removeAttachment} />

          {/* Input area */}
          <InputArea
            inputText={inputText}
            isLoading={isLoading}
            isRecording={isRecording}
            showAttachMenu={showAttachMenu}
            inputRef={inputRef}
            onInputChange={setInputText}
            onKeyDown={handleKeyDown}
            onSend={sendMessage}
            onVoiceInput={handleVoiceInput}
            onToggleAttachMenu={() => setShowAttachMenu(!showAttachMenu)}
            onFileSelect={handleFileSelect}
          />
        </>
      )}
    </div>
  );
}
