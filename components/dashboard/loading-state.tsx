import { Loader2 } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={2} />
    </div>
  );
}
