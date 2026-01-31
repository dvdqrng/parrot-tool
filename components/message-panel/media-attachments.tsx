'use client';

import { BeeperAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Image, Video, Music, Mic, FileText, Loader2, Paperclip } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';

function getMediaSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/media?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isFromMe: boolean;
}

function ImageWithFallback({ src, alt, className, style, onClick, onContextMenu, isFromMe }: ImageWithFallbackProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const handleError = useCallback(() => {
    if (retryCount < maxRetries) {
      // Retry after a delay with cache-busting
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setStatus('loading');
      }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s
    } else {
      setStatus('error');
    }
  }, [retryCount]);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
  }, []);

  // Add retry parameter to bust cache on retry
  const srcWithRetry = retryCount > 0 ? `${src}&retry=${retryCount}` : src;

  if (status === 'error') {
    return (
      <div className={cn(
        "flex items-center text-xs p-2 rounded-lg",
        isFromMe ? "bg-primary-foreground/10 opacity-80" : "bg-muted text-muted-foreground"
      )}>
        <Image className="h-4 w-4" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="relative" onContextMenu={onContextMenu}>
      {status === 'loading' && (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg min-w-[80px] min-h-[80px]",
            isFromMe ? "bg-primary-foreground/10" : "bg-muted"
          )}
          style={style}
        >
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      )}
      <img
        src={srcWithRetry}
        alt={alt}
        className={cn(className, status === 'loading' && 'hidden')}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
      />
    </div>
  );
}

interface VideoWithFallbackProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  isFromMe: boolean;
  duration?: number;
}

function VideoWithFallback({ src, poster, className, style, isFromMe, duration }: VideoWithFallbackProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const handleError = useCallback(() => {
    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setStatus('loading');
      }, 1000 * (retryCount + 1));
    } else {
      setStatus('error');
    }
  }, [retryCount]);

  const handleCanPlay = useCallback(() => {
    setStatus('loaded');
  }, []);

  const srcWithRetry = retryCount > 0 ? `${src}&retry=${retryCount}` : src;

  const formatDuration = (d?: number) => {
    if (!d) return '';
    return ` (${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')})`;
  };

  if (status === 'error') {
    return (
      <div className={cn(
        "flex items-center gap-2 text-xs p-3 rounded-lg",
        isFromMe ? "bg-primary-foreground/10 opacity-80" : "bg-muted text-muted-foreground"
      )}>
        <Video className="h-4 w-4" strokeWidth={2} />
        <span>Video{formatDuration(duration)}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {status === 'loading' && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg min-h-[100px]",
            isFromMe ? "bg-primary-foreground/10" : "bg-muted"
          )}
          style={style}
        >
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      )}
      <video
        src={srcWithRetry}
        poster={poster}
        controls
        className={cn(className, status === 'loading' && 'opacity-0 h-0')}
        style={style}
        onCanPlay={handleCanPlay}
        onError={handleError}
      />
    </div>
  );
}

// Simple context menu for attachment actions
interface ContextMenuState {
  x: number;
  y: number;
  attachment: BeeperAttachment;
}

function AttachmentContextMenu({
  state,
  onClose,
  onSaveToMemory,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onSaveToMemory: (attachment: BeeperAttachment) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: state.x, top: state.y }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
        onClick={() => {
          onSaveToMemory(state.attachment);
          onClose();
        }}
      >
        <Paperclip className="h-3.5 w-3.5" />
        Save to contact memory
      </button>
    </div>
  );
}

interface MediaAttachmentsProps {
  attachments: BeeperAttachment[];
  isFromMe: boolean;
  onSaveToMemory?: (attachment: BeeperAttachment) => void;
}

export function MediaAttachments({ attachments, isFromMe, onSaveToMemory }: MediaAttachmentsProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, att: BeeperAttachment) => {
    if (!onSaveToMemory) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, attachment: att });
  }, [onSaveToMemory]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att, index) => {
        const mediaSrc = getMediaSrc(att.srcURL);
        const posterSrc = getMediaSrc(att.posterImg);

        // Image (including GIF and sticker)
        if (att.type === 'img' || att.isGif || att.isSticker) {
          return (
            <div key={index} className="relative">
              {mediaSrc ? (
                <ImageWithFallback
                  src={mediaSrc}
                  alt={att.fileName || 'Image'}
                  className={cn(
                    "max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity",
                    att.isSticker && "bg-transparent max-h-32",
                    !att.isSticker && "max-h-64"
                  )}
                  style={att.size ? {
                    maxWidth: Math.min(att.size.width || 256, 256),
                    aspectRatio: att.size.width && att.size.height
                      ? `${att.size.width} / ${att.size.height}`
                      : undefined
                  } : undefined}
                  onClick={() => window.open(mediaSrc, '_blank')}
                  onContextMenu={(e) => handleContextMenu(e, att)}
                  isFromMe={isFromMe}
                />
              ) : (
                <div className={cn(
                  "flex items-center text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Image className="h-4 w-4" strokeWidth={2} />
                </div>
              )}
            </div>
          );
        }

        // Video
        if (att.type === 'video') {
          return (
            <div
              key={index}
              className="relative"
              onContextMenu={(e) => handleContextMenu(e, att)}
            >
              {mediaSrc ? (
                <VideoWithFallback
                  src={mediaSrc}
                  poster={posterSrc}
                  className="max-w-full max-h-64 rounded-lg"
                  style={att.size ? {
                    maxWidth: Math.min(att.size.width || 256, 256),
                  } : undefined}
                  isFromMe={isFromMe}
                  duration={att.duration}
                />
              ) : (
                <div className={cn(
                  "flex items-center text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Video className="h-4 w-4" strokeWidth={2} />
                </div>
              )}
            </div>
          );
        }

        // Audio / Voice note
        if (att.type === 'audio' || att.isVoiceNote) {
          return (
            <div
              key={index}
              className="w-full"
              onContextMenu={(e) => handleContextMenu(e, att)}
            >
              {mediaSrc ? (
                <audio
                  src={mediaSrc}
                  controls
                  className="w-full max-w-[200px] h-8"
                />
              ) : (
                <div className={cn(
                  "flex items-center text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  {att.isVoiceNote ? <Mic className="h-4 w-4" strokeWidth={2} /> : <Music className="h-4 w-4" strokeWidth={2} />}
                </div>
              )}
            </div>
          );
        }

        // File / Unknown
        if (att.type === 'unknown' && att.fileName) {
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 text-xs p-2 rounded-lg cursor-pointer hover:opacity-80",
                isFromMe ? "bg-primary-foreground/10" : "bg-background/50"
              )}
              onClick={() => mediaSrc && window.open(mediaSrc, '_blank')}
              onContextMenu={(e) => handleContextMenu(e, att)}
            >
              <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="truncate">{att.fileName}</span>
              {att.fileSize && (
                <span className="text-xs opacity-60 shrink-0">
                  ({(att.fileSize / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* Context menu */}
      {contextMenu && onSaveToMemory && (
        <AttachmentContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onSaveToMemory={onSaveToMemory}
        />
      )}
    </div>
  );
}
