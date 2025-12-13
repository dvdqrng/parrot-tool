'use client';

import { ToneSettingsSection } from '@/components/tone-settings';

export default function TonePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-medium">Tone of Voice</h2>
        <p className="text-xs text-muted-foreground">
          Define your personal communication style for AI-generated suggestions
        </p>
      </div>

      <ToneSettingsSection />
    </div>
  );
}
