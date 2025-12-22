import { Button } from '@/components/ui/button';
import { Copy, Check, Volume2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseMessageContent } from './utils';

interface AssistantMessageProps {
  messageId: string;
  content: string;
  onUseDraft?: (draft: string) => void;
  onCopy: (id: string, content: string) => void;
  onSpeak: (text: string) => void;
  copiedId: string | null;
  isSpeaking: boolean;
}

export function AssistantMessage({
  messageId,
  content,
  onUseDraft,
  onCopy,
  onSpeak,
  copiedId,
  isSpeaking,
}: AssistantMessageProps) {
  const cleanContent = content.replace(/<\/?draft>/g, '');

  return (
    <div className="max-w-[90%] space-y-2">
      {parseMessageContent(content).map((part, idx) => (
        <div key={idx}>
          {part.type === 'text' ? (
            <div className="rounded-2xl px-4 py-2 bg-muted">
              <p className="text-xs whitespace-pre-wrap">{part.content}</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-muted/50">
                <p className="text-xs whitespace-pre-wrap">{part.content}</p>
              </div>
              {onUseDraft && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-none border-t"
                  onClick={() => onUseDraft(part.content)}
                >
                  <span className="text-xs">Use as draft</span>
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-1 px-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onCopy(messageId, cleanContent)}
        >
          {copiedId === messageId ? (
            <Check className="h-4 w-4 mr-1" strokeWidth={2} />
          ) : (
            <Copy className="h-4 w-4 mr-1" strokeWidth={2} />
          )}
          <span className="text-xs">{copiedId === messageId ? 'Copied' : 'Copy all'}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs text-muted-foreground hover:text-foreground",
            isSpeaking && "text-primary"
          )}
          onClick={() => onSpeak(cleanContent)}
          title={isSpeaking ? "Stop speaking" : "Read aloud"}
        >
          {isSpeaking ? (
            <Square className="h-4 w-4 mr-1" strokeWidth={2} />
          ) : (
            <Volume2 className="h-4 w-4 mr-1" strokeWidth={2} />
          )}
          <span className="text-xs">{isSpeaking ? 'Stop' : 'Listen'}</span>
        </Button>
      </div>
    </div>
  );
}
