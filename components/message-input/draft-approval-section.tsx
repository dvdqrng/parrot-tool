'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  updateScheduledAction,
  deleteScheduledAction,
  addAutopilotActivityEntry,
  generateId,
} from '@/lib/storage';
import { toast } from 'sonner';

interface DraftApprovalSectionProps {
  chatId: string;
  agentId: string;
  pendingDraft: string;
  pendingActionId: string;
  onApprove: () => void;
  onReject: () => void;
  onRedo: () => void;
  isRegenerating?: boolean;
}

export function DraftApprovalSection({
  chatId,
  agentId,
  pendingDraft,
  pendingActionId,
  onApprove,
  onReject,
  onRedo,
  isRegenerating = false,
}: DraftApprovalSectionProps) {
  const handleApproveDraft = async () => {
    try {
      updateScheduledAction(pendingActionId, {
        scheduledFor: new Date().toISOString(),
      });

      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId,
        type: 'message-sent',
        timestamp: new Date().toISOString(),
        messageText: pendingDraft,
        metadata: { manuallyApproved: true },
      });

      toast.success('Draft approved and will be sent');
      onApprove();
    } catch (error) {
      console.error('Failed to approve draft:', error);
      toast.error('Failed to approve draft');
    }
  };

  const handleRejectDraft = () => {
    try {
      deleteScheduledAction(pendingActionId);

      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId,
        type: 'draft-generated', // Use draft-generated type, not error
        timestamp: new Date().toISOString(),
        draftText: pendingDraft,
        metadata: {
          rejected: true,
          reason: 'User rejected draft'
        },
      });

      toast.success('Draft rejected - Autopilot will continue with next message');
      onReject();
    } catch (error) {
      console.error('Failed to reject draft:', error);
      toast.error('Failed to reject draft');
    }
  };

  const handleRedoDraft = () => {
    try {
      deleteScheduledAction(pendingActionId);
      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId,
        type: 'draft-generated',
        timestamp: new Date().toISOString(),
        draftText: pendingDraft,
        metadata: {
          regenerated: true,
          reason: 'User requested regeneration'
        },
      });
      toast.success('Requesting new draft...');
      onRedo();
    } catch (error) {
      console.error('Failed to redo draft:', error);
      toast.error('Failed to redo draft');
    }
  };

  return (
    <div className="space-y-2">
      {/* Draft Preview */}
      <div className="text-sm whitespace-pre-wrap p-3 rounded-lg border max-h-[80px] overflow-y-auto bg-muted/50">
        {isRegenerating ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            <span>Generating new draft...</span>
          </div>
        ) : (
          pendingDraft
        )}
      </div>

      {/* Approval Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleRejectDraft} disabled={isRegenerating}>
          Reject Draft
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleRedoDraft} disabled={isRegenerating}>
          Redo
        </Button>
        <Button className="flex-1" onClick={handleApproveDraft} disabled={isRegenerating}>
          Approve & Send
        </Button>
      </div>
    </div>
  );
}
