import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Settings, RefreshCw, Plus, Archive } from 'lucide-react';

interface BottomNavigationProps {
  isLoading: boolean;
  showArchivedColumn: boolean;
  onNewContact: () => void;
  onRefresh: () => void;
  onToggleArchived: () => void;
}

export function BottomNavigation({
  isLoading,
  showArchivedColumn,
  onNewContact,
  onRefresh,
  onToggleArchived,
}: BottomNavigationProps) {
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
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
      </Button>
      <Button
        variant={showArchivedColumn ? "default" : "ghost"}
        size="icon"
        className="rounded-full"
        onClick={onToggleArchived}
        title={showArchivedColumn ? "Hide archived column" : "Show archived column"}
      >
        <Archive className="h-4 w-4" strokeWidth={2} />
      </Button>
      <ThemeToggle />
      <Link href="/settings">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-4 w-4" strokeWidth={2} />
        </Button>
      </Link>
    </div>
  );
}
