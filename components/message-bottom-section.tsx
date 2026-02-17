'use client';

import { ManualInputSection } from '@/components/message-input/manual-input-section';

interface MessageBottomSectionProps {
  chatId: string | null;
  chatName: string;
  draftText: string;
  onDraftTextChange: (text: string) => void;
  isSending: boolean;
  sendSuccess: boolean;
  onSend: () => void;
  // AI Companion props
  isAiEnabled?: boolean;
  hasCompanionActivity?: boolean;
  onToggleEnabled?: () => void;
}

export function MessageBottomSection({
  draftText,
  onDraftTextChange,
  isSending,
  sendSuccess,
  onSend,
  isAiEnabled = false,
  hasCompanionActivity = false,
  onToggleEnabled,
}: MessageBottomSectionProps) {
  return (
    <ManualInputSection
      draftText={draftText}
      onDraftTextChange={onDraftTextChange}
      isSending={isSending}
      sendSuccess={sendSuccess}
      onSend={onSend}
      isAiEnabled={isAiEnabled}
      hasCompanionActivity={hasCompanionActivity}
      onToggleEnabled={onToggleEnabled}
    />
  );
}
