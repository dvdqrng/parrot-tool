'use client';


interface PlatformIconProps {
  platform: string;
  className?: string;
}

const platformIcons: Record<string, string> = {
  whatsapp: '/platforms/whatsapp.png',
  telegram: '/platforms/telegram.png',
  instagram: '/platforms/instagram.png',
  instagramgo: '/platforms/instagram.png',
  signal: '/platforms/signal.png',
  discord: '/platforms/discord.png',
  slack: '/platforms/slack.png',
  slackgo: '/platforms/slack.png',
  imessage: '/platforms/imessage.png',
  googlemessages: '/platforms/googlemessages.png',
  google: '/platforms/googlemessages.png',
  messenger: '/platforms/messenger.png',
  facebook: '/platforms/messenger.png',
  twitter: '/platforms/x.png',
  x: '/platforms/x.png',
  linkedin: '/platforms/linkedin.png',
  sms: '/platforms/sms.png',
};

export function PlatformIcon({ platform, className = 'h-5 w-5' }: PlatformIconProps) {
  const normalizedPlatform = platform.toLowerCase();
  const iconPath = platformIcons[normalizedPlatform] || '/platforms/default.png';

  // WhatsApp icon needs to be slightly larger due to its shape
  const sizeClass = normalizedPlatform === 'whatsapp' ? 'h-4 w-4' : className;

  return (
    <img
      src={iconPath}
      alt={`${platform} icon`}
      className={sizeClass}
    />
  );
}
