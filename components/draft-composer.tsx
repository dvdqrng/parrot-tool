'use client';

import { useState, useCallback } from 'react';
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
import { loadSettings } from '@/lib/storage';
import { Loader2, Sparkles, Send, Save, Trash2 } from 'lucide-react';
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

  const generateAISuggestion = useCallback(async () => {
    setIsGenerating(true);
    try {
      const settings = loadSettings();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey) {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      }

      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          originalMessage: originalText,
          senderName: recipientName,
          tone: 'friendly',
        }),
      });

      const result = await response.json();
      if (result.data?.suggestedReply) {
        setDraftText(result.data.suggestedReply);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      toast.error('Failed to generate AI suggestion');
    } finally {
      setIsGenerating(false);
    }
  }, [originalText, recipientName]);

  const handleSave = useCallback(() => {
    onSave(draftText);
    onOpenChange(false);
  }, [draftText, onSave, onOpenChange]);

  const handleSend = useCallback(async () => {
    if (!draftText.trim()) return;

    setIsSending(true);
    try {
      await onSend(draftText);
      onOpenChange(false);
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
              className="text-xs"
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
            <p className="text-sm line-clamp-3">{originalText}</p>
          </div>

          <Separator />

          {/* Draft text area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Your reply:</label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateAISuggestion}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
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
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={!draftText.trim() || isSending}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
