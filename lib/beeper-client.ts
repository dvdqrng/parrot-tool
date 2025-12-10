import BeeperDesktop from '@beeper/desktop-api';

// Cache clients by token to avoid recreating them
const clientCache = new Map<string, BeeperDesktop>();

export function getBeeperClient(accessToken?: string): BeeperDesktop {
  // Use provided token, fall back to env var
  const token = accessToken || process.env.BEEPER_ACCESS_TOKEN || '';

  // Return cached client if exists for this token
  if (clientCache.has(token)) {
    return clientCache.get(token)!;
  }

  // Create new client
  const client = new BeeperDesktop({
    accessToken: token || undefined,
  });

  // Cache it
  if (token) {
    clientCache.set(token, client);
  }

  return client;
}

// Helper to extract platform name from account ID
export function getPlatformFromAccountId(accountId: string): string {
  // Account IDs typically look like "local-telegram_ba_xxx" or "whatsapp_xxx"
  const parts = accountId.split('_');
  if (parts.length > 0) {
    const firstPart = parts[0]?.replace('local-', '') || 'unknown';
    return firstPart;
  }
  return 'unknown';
}

// Platform display names and colors
export const platformInfo: Record<string, { name: string; color: string }> = {
  telegram: { name: 'Telegram', color: '#0088cc' },
  whatsapp: { name: 'WhatsApp', color: '#25D366' },
  instagram: { name: 'Instagram', color: '#E4405F' },
  signal: { name: 'Signal', color: '#3A76F0' },
  discord: { name: 'Discord', color: '#5865F2' },
  slack: { name: 'Slack', color: '#4A154B' },
  imessage: { name: 'iMessage', color: '#34C759' },
  googlemessages: { name: 'Google Messages', color: '#1A73E8' },
  messenger: { name: 'Messenger', color: '#0084FF' },
  twitter: { name: 'Twitter/X', color: '#1DA1F2' },
  linkedin: { name: 'LinkedIn', color: '#0077B5' },
  unknown: { name: 'Unknown', color: '#6B7280' },
};

export function getPlatformInfo(platform: string): { name: string; color: string } {
  return platformInfo[platform.toLowerCase()] || platformInfo.unknown;
}
