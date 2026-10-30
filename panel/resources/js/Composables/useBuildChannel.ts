import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { BuildLogEntry, BuildStatusEvent } from '@/types';

interface Options {
    uuid: string;
    initialLogs?: BuildLogEntry[];
    onStatus?: (event: BuildStatusEvent) => void;
    pollIntervalMs?: number;
}

export function useBuildChannel(options: Options) {
    const logs = ref<BuildLogEntry[]>([...(options.initialLogs ?? [])].sort((a, b) => a.sequence - b.sequence));
    const latestSequence = ref(logs.value.at(-1)?.sequence ?? 0);
    const connected = ref(false);
    const realtime = ref(false);

    let channel: any = null;
    let logTimer: number | undefined;
    let statusTimer: number | undefined;

    function append(entry: BuildLogEntry): void {
        if (!entry || typeof entry.sequence !== 'number' || typeof entry.message !== 'string') {
            return;
        }

        if (logs.value.some((item) => item.sequence === entry.sequence)) {
            return;
        }

        logs.value.push(entry);
        logs.value.sort((a, b) => a.sequence - b.sequence);
        latestSequence.value = Math.max(latestSequence.value, entry.sequence);
        connected.value = true;

        if (logs.value.length > 2000) {
            logs.value.splice(0, logs.value.length - 2000);
        }
    }

    async function fetchJson<T>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                return null;
            }

            return await response.json() as T;
        } catch {
            return null;
        }
    }

    async function pollLogs(): Promise<void> {
        if (document.visibilityState === 'hidden') {
            return;
        }

        const payload = await fetchJson<{
            success: boolean;
            data: BuildLogEntry[];
            meta: { latestSequence: number };
        }>(`/builds/${options.uuid}/logs?after=${latestSequence.value}`);

        if (!payload?.data) {
            return;
        }

        payload.data.forEach(append);
        connected.value = true;
    }

    async function pollStatus(): Promise<void> {
        if (document.visibilityState === 'hidden') {
            return;
        }

        const payload = await fetchJson<{ success: boolean; data: BuildStatusEvent }>(
            `/builds/${options.uuid}/status`,
        );

        if (payload?.data) {
            options.onStatus?.(payload.data);
        }
    }

    onMounted(() => {
        const echo = window.Echo;

        if (echo) {
            channel = echo.private(`builds.${options.uuid}`);
            channel.listen('.BuildLogAppended', (entry: BuildLogEntry) => append(entry));
            channel.listen('.BuildStatusChanged', (event: BuildStatusEvent) => {
                options.onStatus?.(event);
                connected.value = true;
            });
            realtime.value = true;
        }

        const interval = options.pollIntervalMs ?? 8000;

        logTimer = window.setInterval(() => { void pollLogs(); }, interval);
        statusTimer = window.setInterval(() => { void pollStatus(); }, Math.max(2000, interval / 2));
        void pollStatus();
    });

    onBeforeUnmount(() => {
        if (logTimer) {
            window.clearInterval(logTimer);
        }
        if (statusTimer) {
            window.clearInterval(statusTimer);
        }
        if (channel) {
            channel.stopListening('.BuildLogAppended');
            channel.stopListening('.BuildStatusChanged');
        }
        window.Echo?.leave(`builds.${options.uuid}`);
    });

    return {
        logs,
        latestSequence,
        connected,
        realtime,
        pollLogs,
        pollStatus,
    };
}
