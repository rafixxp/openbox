import type { RunnerLogger } from '../services/runner';

/**
 * Structured, single-line logger for worker processes. Fastify logs requests
 * itself; this only covers build lifecycle events.
 */
export function createLogger(service: string): RunnerLogger {
    const write = (level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void => {
        const line = JSON.stringify({
            level,
            service,
            message,
            time: new Date().toISOString(),
            ...(context ?? {}),
        });

        if (level === 'error') {
            console.error(line);

            return;
        }

        if (level === 'warn') {
            console.warn(line);

            return;
        }

        console.info(line);
    };

    return {
        info: (message, context) => write('info', message, context),
        warn: (message, context) => write('warn', message, context),
        error: (message, context) => write('error', message, context),
    };
}
