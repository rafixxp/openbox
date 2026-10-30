import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useBuildChannel } from '@/Composables/useBuildChannel';
import type { BuildLogEntry, BuildStatusEvent } from '@/types';

type Handler = (payload: unknown) => void;

const handlers: Record<string, Handler> = {};
const stopListening = vi.fn();
const leave = vi.fn();

function installEcho(): void {
    (window as unknown as { Echo?: unknown }).Echo = {
        private: vi.fn(() => ({
            listen: (event: string, callback: Handler) => {
                handlers[event] = callback;
            },
            stopListening,
        })),
        leave,
    };
}

interface Harness {
    logs: BuildLogEntry[];
    latestSequence: number;
    connected: boolean;
    realtime: boolean;
    pollLogs: () => Promise<void>;
    pollStatus: () => Promise<void>;
}

function harness(props: {
    uuid?: string;
    initialLogs?: BuildLogEntry[];
    onStatus?: (event: BuildStatusEvent) => void;
    pollIntervalMs?: number;
}) {
    const Component = defineComponent({
        setup() {
            return useBuildChannel({
                uuid: props.uuid ?? 'build-uuid',
                initialLogs: props.initialLogs,
                onStatus: props.onStatus,
                pollIntervalMs: props.pollIntervalMs,
            });
        },
        render: () => null,
    });

    return mount(Component).vm as unknown as Harness;
}

describe('useBuildChannel', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.keys(handlers).forEach((key) => delete handlers[key]);
        stopListening.mockClear();
        leave.mockClear();
        installEcho();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        delete (window as unknown as { Echo?: unknown }).Echo;
    });

    it('sorts initial logs by sequence', () => {
        const vm = harness({
            initialLogs: [
                { sequence: 2, level: 'info', message: 'second' },
                { sequence: 1, level: 'info', message: 'first' },
            ],
        });

        expect(vm.logs.map((entry) => entry.sequence)).toEqual([1, 2]);
        expect(vm.latestSequence).toBe(2);
    });

    it('appends realtime entries and ignores duplicates', async () => {
        const vm = harness({ initialLogs: [] });

        handlers['.BuildLogAppended']({ sequence: 1, level: 'info', message: 'boot' });
        handlers['.BuildLogAppended']({ sequence: 1, level: 'info', message: 'boot again' });
        handlers['.BuildLogAppended']({ sequence: 2, level: 'error', message: 'boom' });

        await Promise.resolve();

        expect(vm.logs.map((entry) => entry.message)).toEqual(['boot', 'boom']);
        expect(vm.latestSequence).toBe(2);
        expect(vm.realtime).toBe(true);
        expect(vm.connected).toBe(true);
    });

    it('forwards realtime status events to the callback', () => {
        const onStatus = vi.fn();
        harness({ onStatus });

        const event: BuildStatusEvent = {
            uuid: 'build-uuid',
            status: 'succeeded',
            stage: 'finished',
            progress: 100,
            exitCode: 0,
            errorMessage: null,
            artifactSize: 1024,
            artifactSha256: 'a'.repeat(64),
            finishedAt: '2026-01-01T00:00:00Z',
        };

        handlers['.BuildStatusChanged'](event);

        expect(onStatus).toHaveBeenCalledWith(event);
    });

    it('falls back to polling and only requests newer sequences', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = String(input);

            if (url.includes('/logs')) {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        data: [{ sequence: 4, level: 'info', message: 'polled' }],
                        meta: { latestSequence: 4 },
                    }),
                };
            }

            return {
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        uuid: 'build-uuid',
                        status: 'running',
                        stage: 'chroot',
                        progress: 50,
                        exitCode: null,
                        errorMessage: null,
                        artifactSize: null,
                        artifactSha256: null,
                        finishedAt: null,
                    },
                }),
            };
        });

        vi.stubGlobal('fetch', fetchMock);

        const vm = harness({
            initialLogs: [{ sequence: 3, level: 'info', message: 'initial' }],
            pollIntervalMs: 5000,
        });

        await vi.advanceTimersByTimeAsync(5000);

        const logCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/logs?after=3'));

        expect(logCall).toBeDefined();
        expect(vm.logs.map((entry) => entry.sequence)).toEqual([3, 4]);
        expect(vm.latestSequence).toBe(4);
    });

    it('reports polling mode when Reverb is unavailable', () => {
        delete (window as unknown as { Echo?: unknown }).Echo;

        const vm = harness({});

        expect(vm.realtime).toBe(false);
    });
});
