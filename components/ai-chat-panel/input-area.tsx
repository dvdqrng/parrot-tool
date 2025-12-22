import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Mic, MicOff, Send, Paperclip, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputAreaProps {
  inputText: string;
  isLoading: boolean;
  isRecording: boolean;
  showAttachMenu: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onVoiceInput: () => void;
  onToggleAttachMenu: () => void;
  onFileSelect: (type: 'file' | 'image') => void;
}

export function InputArea({
  inputText,
  isLoading,
  isRecording,
  showAttachMenu,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  onVoiceInput,
  onToggleAttachMenu,
  onFileSelect,
}: InputAreaProps) {
  return (
    <div className="shrink-0 p-4 pt-2">
      {/* Attachment menu */}
      {showAttachMenu && (
        <div className="mb-2 flex gap-2 rounded-lg border bg-background p-2 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => onFileSelect('file')}
          >
            <Paperclip className="h-4 w-4 mr-2" strokeWidth={2} />
            File
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => onFileSelect('image')}
          >
            <Image className="h-4 w-4 mr-2" strokeWidth={2} />
            Image
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-full",
            showAttachMenu && "bg-muted"
          )}
          onClick={onToggleAttachMenu}
          disabled={isLoading}
        >
          <Plus className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            showAttachMenu && "rotate-45"
          )} strokeWidth={2} />
        </Button>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ask anything"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 h-8"
          disabled={isLoading}
        />
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-full",
            isRecording && "bg-red-100 text-red-600 hover:bg-red-200"
          )}
          onClick={onVoiceInput}
          disabled={isLoading}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Mic className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onSend}
          disabled={!inputText.trim() || isLoading}
          title="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          )}
        </Button>
      </div>
    </div>
  );
}
