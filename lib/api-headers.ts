/**
 * API Headers Utility
 *
 * Helper functions for building request headers.
 */

/**
 * Get headers for Beeper API requests
 */
export function getBeeperHeaders(beeperToken?: string): HeadersInit {
  const headers: HeadersInit = {};

  if (beeperToken) {
    headers['x-beeper-token'] = beeperToken;
  }

  return headers;
}
