/**
 * Utility functions for message panel
 */

/**
 * Convert file:// URLs to proxied API URLs for avatars
 */
export function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}
