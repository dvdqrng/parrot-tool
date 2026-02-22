'use client';

import { ManualInputSection } from '@/components/message-input/manual-input-section';
import { OrbState } from '@/hooks/use-orb-state';

interface MessageBottomSectionProps {
  chatId: string | null;
  chatName: string;
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  // AI Companion props
  orbState?: OrbState;
  orbLabel?: string;
  onToggleEnabled?: () => void;
}

export function MessageBottomSection({
  draftText,
  onDraftTextChange,
  isSending,
  sendSuccess,
  onSend,
  orbState = 'off',
  orbLabel,
  onToggleEnabled,
}: MessageBottomSectionProps) {
  return (
    <ManualInputSection
      draftText={draftText}
      onDraftTextChange={onDraftTextChange}
      isSending={isSending}
      sendSuccess={sendSuccess}
      onSend={onSend}
      orbState={orbState}
      orbLabel={orbLabel}
      onToggleEnabled={onToggleEnabled}
    />
  );
}
