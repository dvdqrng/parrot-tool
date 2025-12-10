'use client';

import { Inbox, PenLine, SendHorizontal, LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ColumnId } from '@/lib/types';

interface ColumnHeaderProps {
  columnId: ColumnId;
  count: number;
}

const columnConfig: Record<ColumnId, { title: string; icon: LucideIcon }> = {
  unread: {
    title: 'Unread',
    icon: Inbox,
  },
  drafts: {
    title: 'Drafts',
    icon: PenLine,
  },
  sent: {
    title: 'Sent',
    icon: SendHorizontal,
  },
};

export function ColumnHeader({ columnId, count }: ColumnHeaderProps) {
  const config = columnConfig[columnId];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">{config.title}</h3>
      </div>
      <Badge variant="secondary" className="ml-2">
        {count}
      </Badge>
    </div>
  );
}
