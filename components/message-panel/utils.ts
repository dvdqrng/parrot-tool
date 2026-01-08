/**
 * Utility functions for message panel
 */

/**
 * Convert file:// and mxc:// URLs to proxied API URLs for avatars
 * - file:// URLs are local files that need to be served through the API
 * - mxc:// URLs are Matrix Content URLs that need to be converted to HTTP
 */
export function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://') || url.startsWith('mxc://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}
