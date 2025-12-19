/**
 * Centralized logging utility with environment-aware log levels.
 *
 * Usage:
 *   logger.debug('Message', { data })  // Only in development
 *   logger.info('Message', { data })   // Always logged
 *   logger.warn('Message', { data })   // Always logged
 *   logger.error('Message', { data })  // Always logged
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Debug logs - only shown in development
   * Use for detailed debugging information
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info logs - always shown
   * Use for general informational messages
   */
  info(message: string, context?: LogContext): void {
    console.log(`[INFO] ${message}`, context || '');
  }

  /**
   * Warning logs - always shown
   * Use for recoverable issues that need attention
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || '');
  }

  /**
   * Error logs - always shown
   * Use for errors that need immediate attention
   */
  error(message: string, error?: Error | string | LogContext): void {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error.message, error.stack);
    } else {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }

  /**
   * Storage-specific debug logs with [Storage] prefix
   */
  storage(operation: string, context?: LogContext): void {
    this.debug(`[Storage] ${operation}`, context);
  }

  /**
   * Autopilot-specific debug logs with [Autopilot] prefix
   */
  autopilot(operation: string, context?: LogContext): void {
    this.debug(`[Autopilot] ${operation}`, context);
  }

  /**
   * Engine-specific debug logs with [Autopilot Engine] prefix
   */
  engine(operation: string, context?: LogContext): void {
    this.debug(`[Autopilot Engine] ${operation}`, context);
  }

  /**
   * Scheduler-specific debug logs with [Autopilot Scheduler] prefix
   */
  scheduler(operation: string, context?: LogContext): void {
    this.debug(`[Autopilot Scheduler] ${operation}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Also export for testing or custom instances
export { Logger };
