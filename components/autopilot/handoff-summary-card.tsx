'use client';

import { Brain, CheckCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConversationHandoffSummary } from '@/lib/types';

interface HandoffSummaryCardProps {
  summary: ConversationHandoffSummary;
  onDismiss: (chatId: string) => void;
  onTakeOver?: (chatId: string) => void;
}

export function HandoffSummaryCard({
  summary,
  onDismiss,
  onTakeOver,
}: HandoffSummaryCardProps) {
  const getGoalStatusColor = () => {
    switch (summary.goalStatus) {
      case 'achieved':
        return 'bg-green-500/10 text-green-500';
      case 'in-progress':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="border-blue-500/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
            <CardTitle className="text-sm">Handoff Summary</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDismiss(summary.chatId)}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground">
            Autopilot has completed its goal
          </span>
          <Badge className={getGoalStatusColor()}>
            {summary.goalStatus === 'achieved' ? 'Goal Achieved' :
             summary.goalStatus === 'in-progress' ? 'In Progress' : 'Unclear'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div>
          <p className="text-xs font-medium mb-1">Summary</p>
          <p className="text-sm text-muted-foreground">{summary.summary}</p>
        </div>

        {/* Key Points */}
        {summary.keyPoints.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">Key Points</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Next Steps */}
        {summary.suggestedNextSteps.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">Suggested Next Steps</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.suggestedNextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-1 text-blue-500" strokeWidth={1.5} />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onDismiss(summary.chatId)}
          >
            Dismiss
          </Button>
          {onTakeOver && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onTakeOver(summary.chatId)}
            >
              Take Over Conversation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
