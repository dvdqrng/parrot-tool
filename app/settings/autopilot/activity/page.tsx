'use client';

import { useEffect, useState } from 'react';
import { Activity, Brain, MessageSquare, AlertCircle, Clock, Filter, LucideIcon, BellOff, Smile, Zap, MessageCircleOff, BookOpen, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loadAutopilotActivity, clearAutopilotActivity } from '@/lib/storage';
import { AutopilotActivityEntry, AutopilotActivityType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS: Record<AutopilotActivityType, LucideIcon> = {
  'draft-generated': MessageSquare,
  'message-sent': MessageSquare,
  'message-received': MessageSquare,
  'goal-detected': Brain,
  'mode-changed': Activity,
  'agent-changed': Brain,
  'error': AlertCircle,
  'paused': Clock,
  'resumed': Activity,
  'handoff-triggered': Brain,
  'time-expired': Clock,
  'skipped-busy': BellOff,
  'emoji-only-sent': Smile,
  'conversation-closing': MessageCircleOff,
  'fatigue-reduced': Zap,
  'history-loading': BookOpen,
  'history-complete': CheckCircle,
  'knowledge-updated': BookOpen,
};

const ACTIVITY_LABELS: Record<AutopilotActivityType, string> = {
  'draft-generated': 'Draft Generated',
  'message-sent': 'Message Sent',
  'message-received': 'Message Received',
  'goal-detected': 'Goal Detected',
  'mode-changed': 'Mode Changed',
  'agent-changed': 'Agent Changed',
  'error': 'Error',
  'paused': 'Paused',
  'resumed': 'Resumed',
  'handoff-triggered': 'Handoff',
  'time-expired': 'Time Expired',
  'skipped-busy': 'Skipped (Busy)',
  'emoji-only-sent': 'Emoji Response',
  'conversation-closing': 'Suggested Closing',
  'fatigue-reduced': 'Fatigue Applied',
  'history-loading': 'Loading History',
  'history-complete': 'History Complete',
  'knowledge-updated': 'Knowledge Updated',
};

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<AutopilotActivityEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const loaded = loadAutopilotActivity();
    setEntries(loaded.reverse()); // Most recent first
  }, []);

  const filteredEntries = filter === 'all'
    ? entries
    : entries.filter(e => e.type === filter);

  const handleClear = () => {
    clearAutopilotActivity();
    setEntries([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" strokeWidth={2} />
            Activity Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View autopilot actions and events
          </p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear Log
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 text-sm">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="message-sent">Messages Sent</SelectItem>
            <SelectItem value="draft-generated">Drafts Generated</SelectItem>
            <SelectItem value="goal-detected">Goals Detected</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="handoff-triggered">Handoffs</SelectItem>
            <SelectItem value="skipped-busy">Skipped (Busy)</SelectItem>
            <SelectItem value="emoji-only-sent">Emoji Responses</SelectItem>
            <SelectItem value="fatigue-reduced">Fatigue Applied</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Activity List */}
      {filteredEntries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Activity className="h-4 w-4 mx-auto text-muted-foreground mb-3" strokeWidth={2} />
            <h3 className="font-medium mb-1">No activity yet</h3>
            <p className="text-sm text-muted-foreground">
              Autopilot activity will appear here when agents take actions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const Icon = ACTIVITY_ICONS[entry.type] || Activity;
            const label = ACTIVITY_LABELS[entry.type] || entry.type;
            const isError = entry.type === 'error';

            return (
              <Card key={entry.id} className={isError ? 'border-destructive/50' : ''}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded ${isError ? 'bg-destructive/10' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${isError ? 'text-destructive' : 'text-muted-foreground'}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs font-medium">{label}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      {entry.messageText && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {entry.messageText}
                        </p>
                      )}
                      {entry.errorMessage && (
                        <p className="text-xs text-destructive mt-1">
                          {entry.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
