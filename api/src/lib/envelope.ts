/**
 * Every JSON response from the agent uses the same envelope as the Laravel
 * panel: { success, data, error, meta }. Errors are never bare strings.
 */
export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}

export interface ApiEnvelope<T> {
    success: boolean;
    data: T | null;
    error: ApiError | null;
    meta: Record<string, unknown>;
}

export function success<T>(data: T, meta: Record<string, unknown> = {}): ApiEnvelope<T> {
    return {
        success: true,
        data,
        error: null,
        meta,
    };
}

export function failure(
    code: string,
    message: string,
    meta: Record<string, unknown> = {},
    details?: unknown,
): ApiEnvelope<never> {
    return {
        success: false,
        data: null,
        error: details === undefined ? { code, message } : { code, message, details },
        meta,
    };
}
