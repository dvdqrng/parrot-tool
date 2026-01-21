'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Record<string, CrmTag>;
  availableChannels: string[];
  selectedTagFilters: Set<string>;
  selectedTypeFilters: Set<'person' | 'group'>;
  selectedChannelFilters: Set<string>;
  onToggleTag: (tagId: string) => void;
  onToggleType: (type: 'person' | 'group') => void;
  onToggleChannel: (channel: string) => void;
  onClearAll: () => void;
}

export function FilterDialog({
  open,
  onOpenChange,
  tags,
  availableChannels,
  selectedTagFilters,
  selectedTypeFilters,
  selectedChannelFilters,
  onToggleTag,
  onToggleType,
  onToggleChannel,
  onClearAll,
}: FilterDialogProps) {
  const hasActiveFilters = selectedTagFilters.size > 0 || selectedTypeFilters.size > 0 || selectedChannelFilters.size > 0;

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
        className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[420px] max-h-[500px] bg-card border rounded-3xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-xs font-medium">Filter</h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-7 text-xs"
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </div>

        {/* Filters content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 space-y-4">
          {/* Type filter */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Type</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTypeFilters.has('person') ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs rounded-full"
                onClick={() => onToggleType('person')}
              >
                Person
              </Button>
              <Button
                variant={selectedTypeFilters.has('group') ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs rounded-full"
                onClick={() => onToggleType('group')}
              >
                Group
              </Button>
            </div>
          </div>

          {/* Channel filter */}
          {availableChannels.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Platform</div>
              <div className="flex flex-wrap gap-2">
                {availableChannels.map(channel => {
                  const platformInfo = getPlatformInfo(channel);
                  const isSelected = selectedChannelFilters.has(channel);
                  return (
                    <Button
                      key={channel}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-3 text-xs rounded-full"
                      onClick={() => onToggleChannel(channel)}
                      style={
                        isSelected
                          ? { backgroundColor: platformInfo.color, borderColor: platformInfo.color }
                          : {}
                      }
                    >
                      {platformInfo.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tag filter */}
          {Object.keys(tags).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Tags</div>
              <div className="flex flex-wrap gap-2">
                {Object.values(tags).map(tag => {
                  const isSelected = selectedTagFilters.has(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-3 text-xs rounded-full"
                      onClick={() => onToggleTag(tag.id)}
                      style={
                        isSelected
                          ? { backgroundColor: tag.color, borderColor: tag.color }
                          : {}
                      }
                    >
                      {tag.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
