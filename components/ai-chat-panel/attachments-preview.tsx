import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AttachmentsPreviewProps {
  attachments: File[];
  onRemove: (index: number) => void;
}

export function AttachmentsPreview({ attachments, onRemove }: AttachmentsPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="shrink-0 px-4 pb-2">
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1"
          >
            <span className="max-w-[100px] truncate text-xs">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
