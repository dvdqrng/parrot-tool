'use client';

import { Check, X, Brain, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface PendingApprovalCardProps {
  chatId: string;
  draftText: string;
  agentName: string;
  recipientName: string;
  timestamp: string;
  onApprove: (chatId: string) => void;
  onReject: (chatId: string) => void;
  onEdit?: (chatId: string, text: string) => void;
}

export function PendingApprovalCard({
  chatId,
  draftText,
  agentName,
  recipientName,
  timestamp,
  onApprove,
  onReject,
  onEdit,
}: PendingApprovalCardProps) {
  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Autopilot Draft</CardTitle>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {agentName} drafted a reply to {recipientName}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-muted rounded-lg p-3">
          <p className="text-sm whitespace-pre-wrap">{draftText}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onReject(chatId)}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(chatId, draftText)}
            >
              Edit
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onApprove(chatId)}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve & Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
