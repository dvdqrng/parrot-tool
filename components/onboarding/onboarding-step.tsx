'use client';

import { CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OnboardingStepProps {
  stepNumber: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  children: React.ReactNode;
}

export function OnboardingStep({
  stepNumber,
  title,
  description,
  isComplete,
  isActive,
  children,
}: OnboardingStepProps) {
  return (
    <Card className={cn(
      'transition-all duration-200',
      isActive && 'ring-2 ring-primary',
      !isActive && !isComplete && 'opacity-50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
            isComplete ? 'bg-green-100 text-green-700' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {isComplete ? (
              <CheckCircle className="h-4 w-4" strokeWidth={2} />
            ) : (
              stepNumber
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xs font-medium flex items-center gap-2">
              {title}
              {isComplete && (
                <span className="text-green-600 text-xs font-normal">Complete</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {isActive && (
        <CardContent className="pt-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
