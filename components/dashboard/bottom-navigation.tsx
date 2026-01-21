import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Settings, Plus, Layers, Monitor, Users, LayoutGrid, Filter } from 'lucide-react';
import { KanbanGroupBy } from '@/lib/types';

export type MainView = 'kanban' | 'contacts';

interface BottomNavigationProps {
  onNewContact: () => void;
  groupBy: KanbanGroupBy;
  onGroupByChange: (groupBy: KanbanGroupBy) => void;
  currentView: MainView;
  onViewChange: (view: MainView) => void;
  onFilterClick?: () => void;
  onGroupByClick?: () => void;
  hasActiveFilters?: boolean;
}

const groupByOptions: { value: KanbanGroupBy; label: string; icon: typeof Layers }[] = [
  { value: 'status', label: 'Status', icon: Layers },
  { value: 'platform', label: 'Platform', icon: Monitor },
];

export function BottomNavigation({
  onNewContact,
  groupBy,
  onGroupByChange,
  currentView,
  onViewChange,
  onFilterClick,
  onGroupByClick,
  hasActiveFilters = false,
}: BottomNavigationProps) {
  const currentOption = groupByOptions.find(o => o.value === groupBy) || groupByOptions[0];

  return (
    <div className="flex items-center gap-2 rounded-full bg-white dark:bg-card shadow-lg dark:border px-2 py-2">
      {/* View Toggle - single button */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => onViewChange(currentView === 'kanban' ? 'contacts' : 'kanban')}
        title={currentView === 'kanban' ? 'Switch to Contacts view' : 'Switch to Kanban view'}
      >
        {currentView === 'kanban' ? (
          <Users className="h-4 w-4" strokeWidth={2} />
        ) : (
          <LayoutGrid className="h-4 w-4" strokeWidth={2} />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={onNewContact}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </Button>

      {/* Filter button - show for both views */}
      {onFilterClick && (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full relative"
          onClick={onFilterClick}
          title="Filter"
        >
          <Filter className="h-4 w-4" strokeWidth={2} fill={hasActiveFilters ? 'currentColor' : 'none'} />
        </Button>
      )}

      {/* Only show group by selector in kanban view */}
      {currentView === 'kanban' && onGroupByClick && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-8 px-3 gap-1.5"
          onClick={onGroupByClick}
        >
          <currentOption.icon className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="text-xs">{currentOption.label}</span>
        </Button>
      )}

      <ThemeToggle />
      <Link href="/settings">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-4 w-4" strokeWidth={2} />
        </Button>
      </Link>
    </div>
  );
}
