'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Layers, Monitor } from 'lucide-react';
import { KanbanGroupBy } from '@/lib/types';

interface GroupByDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupBy: KanbanGroupBy;
  onGroupByChange: (groupBy: KanbanGroupBy) => void;
}

const groupByOptions: { value: KanbanGroupBy; label: string; icon: typeof Layers }[] = [
  { value: 'status', label: 'Status', icon: Layers },
  { value: 'platform', label: 'Platform', icon: Monitor },
];

export function GroupByDialog({
  open,
  onOpenChange,
  groupBy,
  onGroupByChange,
}: GroupByDialogProps) {
  // Track if component should be visible (for animation)
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Small delay to ensure element is in DOM before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (value: KanbanGroupBy) => {
    onGroupByChange(value);
    onOpenChange(false);
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Blurred backdrop */}
      <div
        className={`fixed inset-0 -z-10 bg-background/60 backdrop-blur-sm transition-opacity duration-150 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog - positioned relative to parent (bottom nav wrapper) */}
      <div
        className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[280px] bg-card border rounded-3xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-xs font-medium">Group By</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        {/* Options */}
        <div className="px-4 pb-4 space-y-2">
          {groupByOptions.map((option) => (
            <Button
              key={option.value}
              variant={groupBy === option.value ? 'default' : 'outline'}
              className="w-full justify-start h-10 px-3 text-xs rounded-2xl"
              onClick={() => handleSelect(option.value)}
            >
              <option.icon className="h-4 w-4 mr-2" strokeWidth={2} />
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
