import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Plus, Layers, Monitor } from 'lucide-react';
import { KanbanGroupBy } from '@/lib/types';

interface BottomNavigationProps {
  onNewContact: () => void;
  groupBy: KanbanGroupBy;
  onGroupByChange: (groupBy: KanbanGroupBy) => void;
}

const groupByOptions: { value: KanbanGroupBy; label: string; icon: typeof Layers }[] = [
  { value: 'status', label: 'Status', icon: Layers },
  { value: 'platform', label: 'Platform', icon: Monitor },
];

export function BottomNavigation({
  onNewContact,
  groupBy,
  onGroupByChange,
}: BottomNavigationProps) {
  const currentOption = groupByOptions.find(o => o.value === groupBy) || groupByOptions[0];

  return (
    <div className="flex items-center gap-2 rounded-full bg-white dark:bg-card shadow-lg dark:border px-2 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={onNewContact}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-full h-8 px-3 gap-1.5">
            <currentOption.icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-xs">{currentOption.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {groupByOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onGroupByChange(option.value)}
              className={groupBy === option.value ? 'bg-accent' : ''}
            >
              <option.icon className="h-4 w-4 mr-2" strokeWidth={2} />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle />
      <Link href="/settings">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-4 w-4" strokeWidth={2} />
        </Button>
      </Link>
    </div>
  );
}
