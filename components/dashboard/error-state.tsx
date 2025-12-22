import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="rounded-lg bg-destructive/10 p-6 text-center text-destructive">
        <p className="text-xs font-medium">Connection Error</p>
        <p className="text-xs">{error}</p>
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
