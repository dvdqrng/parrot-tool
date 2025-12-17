/**
 * Formats time remaining in seconds to a human-readable string
 * @param seconds - Time in seconds, can be null
 * @param format - 'long' for detailed format (e.g., "5m 30s"), 'short' for compact (e.g., "5m")
 * @returns Formatted time string, or empty string if invalid
 */
export function formatTimeRemaining(
  seconds: number | null | undefined,
  format: 'long' | 'short' = 'long'
): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return '';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return format === 'short' ? `${hrs}h` : `${hrs}h ${remainingMins}m`;
  }

  if (mins > 0) {
    return format === 'short' ? `${mins}m` : `${mins}m ${secs}s`;
  }

  return `${secs}s`;
}
