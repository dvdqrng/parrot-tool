import { BeeperAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Image, Video, Music, Mic, FileText } from 'lucide-react';

function getMediaSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/media?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface MediaAttachmentsProps {
  attachments: BeeperAttachment[];
  isFromMe: boolean;
}

export function MediaAttachments({ attachments, isFromMe }: MediaAttachmentsProps) {
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
                <img
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
                  onClick={() => mediaSrc && window.open(mediaSrc, '_blank')}
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Image className="h-4 w-4" strokeWidth={2} />
                  <span>{att.isGif ? 'GIF' : att.isSticker ? 'Sticker' : 'Photo'}</span>
                </div>
              )}
            </div>
          );
        }

        // Video
        if (att.type === 'video') {
          return (
            <div key={index} className="relative">
              {mediaSrc ? (
                <video
                  src={mediaSrc}
                  poster={posterSrc}
                  controls
                  className="max-w-full max-h-64 rounded-lg"
                  style={att.size ? {
                    maxWidth: Math.min(att.size.width || 256, 256),
                  } : undefined}
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  <Video className="h-4 w-4" strokeWidth={2} />
                  <span>Video{att.duration ? ` (${Math.floor(att.duration / 60)}:${(att.duration % 60).toString().padStart(2, '0')})` : ''}</span>
                </div>
              )}
            </div>
          );
        }

        // Audio / Voice note
        if (att.type === 'audio' || att.isVoiceNote) {
          return (
            <div key={index} className="w-full">
              {mediaSrc ? (
                <audio
                  src={mediaSrc}
                  controls
                  className="w-full max-w-[200px] h-8"
                />
              ) : (
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isFromMe ? "opacity-80" : "text-muted-foreground"
                )}>
                  {att.isVoiceNote ? <Mic className="h-4 w-4" strokeWidth={2} /> : <Music className="h-4 w-4" strokeWidth={2} />}
                  <span>{att.isVoiceNote ? 'Voice message' : 'Audio'}{att.duration ? ` (${Math.floor(att.duration / 60)}:${(att.duration % 60).toString().padStart(2, '0')})` : ''}</span>
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
    </div>
  );
}
