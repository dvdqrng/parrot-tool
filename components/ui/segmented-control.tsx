'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const activeEl = itemRefs.current.get(value);
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    setIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
    });
  }, [value]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Re-measure on resize
  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'isolate relative flex border rounded-full p-1 gap-1',
        className,
      )}
    >
      {/* Animated indicator */}
      {indicator && (
        <div
          className="absolute top-1 bottom-1 z-0 rounded-full bg-foreground shadow-sm transition-all duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}

      {items.map(({ value: itemValue, label, icon: Icon }) => (
        <button
          key={itemValue}
          ref={(el) => {
            if (el) itemRefs.current.set(itemValue, el);
            else itemRefs.current.delete(itemValue);
          }}
          onClick={() => onValueChange(itemValue)}
          className={cn(
            'relative z-[1] flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors duration-150',
            value === itemValue
              ? 'text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10',
          )}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </button>
      ))}
    </div>
  );
}
