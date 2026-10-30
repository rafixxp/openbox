<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import { useBuildChannel } from '@/Composables/useBuildChannel';
import type { Build, BuildStatusEvent } from '@/types';
import { formatBytes, formatDateTime, shortUuid } from '@/lib/format';

const props = defineProps<{ build: Build }>();

const current = reactive<Build>({ ...props.build, logs: undefined });
const logEl = ref<HTMLElement | null>(null);
const autoScroll = ref(true);
const copied = ref(false);
const reloadedAfterFinish = ref(false);

const { logs, connected, realtime } = useBuildChannel({
    uuid: props.build.uuid,
    initialLogs: props.build.logs ?? [],
    onStatus: (event: BuildStatusEvent) => {
        current.status = event.status;
        current.stage = event.stage;
        current.progress = event.progress;
        current.exitCode = event.exitCode;
        current.errorMessage = event.errorMessage;
        current.finishedAt = event.finishedAt;

        if (event.status === 'succeeded' && !reloadedAfterFinish.value) {
            reloadedAfterFinish.value = true;
            router.reload({ only: ['build'] });
        }
    },
});

watch(() => props.build, (value) => {
    Object.assign(current, value, { logs: undefined });
}, { deep: true });

watch(() => logs.value.length, async () => {
    if (!autoScroll.value) {
        return;
    }

    await nextTick();
    const element = logEl.value;

    if (element) {
        element.scrollTop = element.scrollHeight;
    }
});

const active = computed(() => ['queued', 'dispatching', 'running'].includes(current.status));

const levelClass: Record<string, string> = {
    error: 'text-rose-400',
    warning: 'text-amber-300',
    debug: 'text-slate-500',
    info: 'text-slate-300',
};

function cancel(): void {
    router.post(`/builds/${props.build.uuid}/cancel`, {}, { preserveScroll: true });
}

function retry(): void {
    router.post(`/builds/${props.build.uuid}/retry`, {}, { preserveScroll: true });
}

async function copyLogs(): Promise<void> {
    await navigator.clipboard.writeText(logs.value.map((entry) => entry.message).join('\n'));
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 1500);
}
</script>

<template>
    <Head :title="`Build ${shortUuid(current.uuid)}`" />

    <AuthenticatedLayout>
        <template #header>
            <div class="flex items-center gap-3">
                <Link href="/builds" class="text-xs text-slate-500 hover:text-slate-300">← Builds</Link>
                <span class="font-mono text-xs text-slate-400">{{ shortUuid(current.uuid) }}</span>
            </div>
        </template>

        <section class="panel-card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="font-mono text-lg font-semibold text-white">{{ current.uuid }}</h1>
                        <StatusBadge :status="current.status" />
                        <span class="badge border-slate-600/40 bg-slate-800/40 text-slate-300 capitalize">{{ current.channel }}</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-500">
                        {{ current.stage ?? 'Waiting for worker' }}
                        · requested by {{ current.requestedBy?.name ?? 'system' }}
                        · {{ formatDateTime(current.createdAt) }}
                    </p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button v-if="current.can.cancel && active" type="button" class="btn-danger" @click="cancel">
                        Cancel
                    </button>
                    <button v-if="current.can.retry && !active" type="button" class="btn-secondary" @click="retry">
                        Retry
                    </button>
                    <a v-if="current.artifact && current.can.download" :href="`/builds/${current.uuid}/download`" class="btn-primary">
                        Download ISO
                    </a>
                </div>
            </div>

            <div class="mt-5">
                <div class="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{{ current.status === 'failed' ? 'Failed at' : 'Progress' }}</span>
                    <span>{{ current.progress }}%</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                        class="h-full rounded-full transition-all duration-500"
                        :class="current.status === 'failed' ? 'bg-rose-400' : 'bg-emerald-400'"
                        :style="{ width: `${current.progress}%` }"
                    />
                </div>
            </div>

            <div v-if="current.errorMessage" class="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {{ current.errorMessage }}
            </div>

            <dl class="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <dt class="text-slate-500">Started</dt>
                    <dd class="mt-1 text-slate-300">{{ formatDateTime(current.startedAt) }}</dd>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <dt class="text-slate-500">Finished</dt>
                    <dd class="mt-1 text-slate-300">{{ formatDateTime(current.finishedAt) }}</dd>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <dt class="text-slate-500">Artifact</dt>
                    <dd class="mt-1 text-slate-300">{{ formatBytes(current.artifact?.size) }}</dd>
                </div>
                <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <dt class="text-slate-500">Agent / driver</dt>
                    <dd class="mt-1 text-slate-300">{{ current.agent ?? '—' }}</dd>
                </div>
            </dl>

            <div v-if="current.artifact?.sha256" class="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
                <p class="text-[11px] uppercase tracking-wider text-slate-500">SHA256</p>
                <p class="mt-1 break-all font-mono text-xs text-emerald-300">{{ current.artifact.sha256 }}</p>
            </div>
        </section>

        <section class="panel-card overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div class="flex items-center gap-3">
                    <h2 class="text-sm font-semibold text-slate-100">Live build log</h2>
                    <span class="badge" :class="realtime
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-600/30 bg-slate-700/10 text-slate-400'">
                        {{ realtime ? 'Reverb' : 'Polling' }}
                    </span>
                    <span v-if="connected" class="text-[11px] text-slate-500">{{ logs.length }} lines</span>
                </div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1.5 text-xs text-slate-500">
                        <input v-model="autoScroll" type="checkbox" class="rounded border-slate-700 bg-slate-900 text-emerald-500">
                        Auto-scroll
                    </label>
                    <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="copyLogs">
                        {{ copied ? 'Copied' : 'Copy' }}
                    </button>
                </div>
            </div>

            <div ref="logEl" class="h-[28rem] overflow-y-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed">
                <div v-if="logs.length === 0" class="flex h-full items-center justify-center text-slate-600">
                    Waiting for log output…
                </div>
                <div v-for="entry in logs" :key="entry.sequence" class="flex gap-3">
                    <span class="w-14 shrink-0 select-none text-right text-slate-700">{{ entry.sequence }}</span>
                    <span class="whitespace-pre-wrap break-words" :class="levelClass[entry.level] ?? 'text-slate-300'">{{ entry.message }}</span>
                </div>
            </div>
        </section>

        <section class="panel-card">
            <details class="group">
                <summary class="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-200">
                    Build manifest
                    <span class="ml-2 text-xs font-normal text-slate-500">immutable JSONB snapshot</span>
                </summary>
                <div class="border-t border-slate-800 p-5">
                    <pre class="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-400">{{ JSON.stringify(current.manifest, null, 2) }}</pre>
                </div>
            </details>
        </section>
    </AuthenticatedLayout>
</template>
