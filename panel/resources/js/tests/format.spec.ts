import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, relativeTime, shortUuid } from '@/lib/format';

describe('format helpers', () => {
    it('shortens a UUID to its first segment', () => {
        expect(shortUuid('12345678-90ab-cdef-1234-567890abcdef')).toBe('12345678');
    });

    it('formats byte values with binary units', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1)).toBe('1 B');
        expect(formatBytes(1024)).toBe('1.0 KiB');
        expect(formatBytes(1536)).toBe('1.5 KiB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MiB');
    });

    it('returns a placeholder for missing byte values', () => {
        expect(formatBytes(null)).toBe('—');
        expect(formatBytes(undefined)).toBe('—');
    });

    it('formats durations in minutes and seconds', () => {
        expect(formatDuration(45)).toBe('45s');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(0)).toBe('—');
        expect(formatDuration(null)).toBe('—');
    });

    it('returns a placeholder for missing relative timestamps', () => {
        expect(relativeTime(null)).toBe('—');
    });

    it('produces a relative label for a recent timestamp', () => {
        const value = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        expect(relativeTime(value)).toMatch(/minute|menit|Minute/i);
    });
});
