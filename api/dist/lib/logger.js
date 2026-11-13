"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
/**
 * Structured, single-line logger for worker processes. Fastify logs requests
 * itself; this only covers build lifecycle events.
 */
function createLogger(service) {
    const write = (level, message, context) => {
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
//# sourceMappingURL=logger.js.map