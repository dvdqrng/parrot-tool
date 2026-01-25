'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Send, Save, Check, Bot, ListStart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedGradientSphere } from '@/components/ui/animated-gradient-sphere';

interface ManualInputSectionProps {
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isGenerating: boolean;
  onGenerateAI: () => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  onSaveDraft: () => void;
  onShowAutopilot?: () => void;
  showAutopilotButton: boolean;
  autopilotButtonHref?: string;
  aiEnabled?: boolean;
}

export function ManualInputSection({
  draftText,
  onDraftTextChange,
  isGenerating,
  onGenerateAI,
  isSending,
  sendSuccess,
  onSend,
  onSaveDraft,
  onShowAutopilot,
  showAutopilotButton,
  autopilotButtonHref,
  aiEnabled = true,
}: ManualInputSectionProps) {
  return (
    <div className="space-y-3">
      {/* Input Textarea */}
      <Textarea
        placeholder="Type your reply..."
        value={draftText}
        onChange={(e) => onDraftTextChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (draftText.trim() && !isSending && !sendSuccess) {
              onSend();
            }
          }
        }}
        className="min-h-[80px] resize-none shadow-none"
      />

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Autopilot Toggle Button - only shown when AI is enabled */}
        {aiEnabled && showAutopilotButton && (
          autopilotButtonHref ? (
            <Button variant="ghost" size="icon" asChild title="Create Agent">
              <a href={autopilotButtonHref}>
                <AnimatedGradientSphere />
              </a>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowAutopilot}
              title="Autopilot"
            >
              <AnimatedGradientSphere />
            </Button>
          )
        )}

        {/* AI Draft Button - only shown when AI is enabled */}
        {aiEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onGenerateAI}
            disabled={isGenerating}
            title="AI Draft"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <ListStart className="h-4 w-4 rotate-180" strokeWidth={2} />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onSaveDraft}
          disabled={!draftText.trim()}
          title="Save Draft"
        >
          <Save className="h-4 w-4" strokeWidth={2} />
        </Button>

        <div className="flex-1" />

        <Button
          className={cn(
            "min-w-[100px] transition-colors",
            sendSuccess && "bg-green-600 hover:bg-green-600"
          )}
          onClick={onSend}
          disabled={!draftText.trim() || isSending || sendSuccess}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
          ) : sendSuccess ? (
            <Check className="h-4 w-4 mr-2" strokeWidth={2} />
          ) : (
            <Send className="h-4 w-4 mr-2" strokeWidth={2} />
          )}
          {isSending ? 'Sending...' : sendSuccess ? 'Sent!' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
