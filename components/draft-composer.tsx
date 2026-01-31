'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Draft, BeeperMessage } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { useAiPipeline } from '@/hooks/use-ai-pipeline';
import { Loader2, Sparkles, Send, Save, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DraftComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // For creating new draft from message
  originalMessage?: BeeperMessage | null;
  // For editing existing draft
  existingDraft?: Draft | null;
  // Callbacks
  onSave: (draftText: string) => void;
  onSend: (draftText: string) => void;
  onDelete?: () => void;
}

export function DraftComposer({
  open,
  onOpenChange,
  originalMessage,
  existingDraft,
  onSave,
  onSend,
  onDelete,
}: DraftComposerProps) {
  const [draftText, setDraftText] = useState(existingDraft?.draftText || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Reset state when dialog opens with new content
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setDraftText(existingDraft?.draftText || '');
    }
    onOpenChange(newOpen);
  }, [existingDraft, onOpenChange]);

  const originalText = existingDraft?.originalText || originalMessage?.text || '';
  const recipientName = existingDraft?.recipientName || originalMessage?.senderName || 'Unknown';
  const platform = existingDraft?.platform || originalMessage?.platform || 'unknown';
  const platformData = getPlatformInfo(platform);
  const chatId = existingDraft?.chatId || originalMessage?.chatId;

  const { generateDraft } = useAiPipeline();

  const generateAISuggestion = useCallback(async () => {
    if (!chatId) return;

    setIsGenerating(true);
    try {
      const result = await generateDraft(chatId, originalText, recipientName);
      if (result.text) {
        setDraftText(result.text);
      }
    } catch (error) {
      logger.error('Failed to generate suggestion:', error instanceof Error ? error : String(error));
      toast.error('Failed to generate AI suggestion');
    } finally {
      setIsGenerating(false);
    }
  }, [chatId, originalText, recipientName, generateDraft]);

  const handleSave = useCallback(() => {
    onSave(draftText);
    onOpenChange(false);
  }, [draftText, onSave, onOpenChange]);

  const handleSend = useCallback(async () => {
    if (!draftText.trim()) return;

    setIsSending(true);
    setSendSuccess(false);
    try {
      await onSend(draftText);
      setSendSuccess(true);
      // Close dialog after showing success briefly
      setTimeout(() => {
        onOpenChange(false);
        setSendSuccess(false);
      }, 1000);
    } catch (error) {
      setSendSuccess(false);
    } finally {
      setIsSending(false);
    }
  }, [draftText, onSend, onOpenChange]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
      onOpenChange(false);
    }
  }, [onDelete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reply to {recipientName}
            <Badge
              variant="secondary"
              style={{
                backgroundColor: `${platformData.color}20`,
                color: platformData.color,
              }}
            >
              {platformData.name}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Compose your reply. Use AI to generate a suggestion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original message context */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Original message from {recipientName}:
            </p>
            <p className="text-xs line-clamp-3">{originalText}</p>
          </div>

          <Separator />

          {/* Draft text area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Your reply:</label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAISuggestion}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" strokeWidth={2} />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" strokeWidth={2} />
                )}
                {isGenerating ? 'Generating...' : 'AI Suggest'}
              </Button>
            </div>
            <Textarea
              placeholder="Type your reply..."
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {existingDraft && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" strokeWidth={2} />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" strokeWidth={2} />
            Save Draft
          </Button>
          <Button
            onClick={handleSend}
            disabled={!draftText.trim() || isSending || sendSuccess}
            className={cn(
              "transition-colors",
              sendSuccess && "bg-green-600 hover:bg-green-600"
            )}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
