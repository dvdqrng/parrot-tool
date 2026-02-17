'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiOrbButton } from '@/components/intelligence/ai-orb-button';

interface ManualInputSectionProps {
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  // AI Companion props
  isAiEnabled?: boolean;
  hasCompanionActivity?: boolean;
  onToggleEnabled?: () => void;
}

export function ManualInputSection({
  draftText,
  onDraftTextChange,
  isSending,
  sendSuccess,
  onSend,
  isAiEnabled = false,
  hasCompanionActivity = false,
  onToggleEnabled,
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
      <div className="flex gap-2 items-center">
        {/* AI Orb Button - inline with send */}
        {onToggleEnabled && (
          <AiOrbButton
            isEnabled={isAiEnabled}
            isPanelOpen={false}
            hasActivity={hasCompanionActivity}
            onToggleEnabled={onToggleEnabled}
            size="md"
          />
        )}

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
