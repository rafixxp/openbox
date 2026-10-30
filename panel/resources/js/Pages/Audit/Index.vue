<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import Pagination from '@/Components/Pagination.vue';
import type { AuditLogEntry, Paginated } from '@/types';
import { formatDateTime } from '@/lib/format';

const props = defineProps<{
    logs: Paginated<AuditLogEntry>;
    filters: { action?: string | null; actor?: string | null; from?: string | null; to?: string | null };
}>();

const filters = reactive({
    action: props.filters.action ?? '',
    actor: props.filters.actor ?? '',
    from: props.filters.from ?? '',
    to: props.filters.to ?? '',
});

const expanded = ref<number | null>(null);

function apply(): void {
    router.get('/audit-logs', {
        action: filters.action || undefined,
        actor: filters.actor || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
    }, { preserveState: true, preserveScroll: true, replace: true });
}

function reset(): void {
    filters.action = '';
    filters.actor = '';
    filters.from = '';
    filters.to = '';
    apply();
}

function toggle(id: number): void {
    expanded.value = expanded.value === id ? null : id;
}
</script>

<template>
    <Head title="Audit trail" />

    <AuthenticatedLayout title="Audit trail">
        <div>
            <h1 class="text-lg font-semibold text-white">Immutable audit log</h1>
            <p class="mt-1 text-sm text-slate-500">
                Append-only, hash-chained records. Each row links to the previous hash; updates and deletes are blocked in the database.
            </p>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <form class="flex flex-wrap items-end gap-2" @submit.prevent="apply">
                    <div>
                        <label for="audit-action" class="label">Action prefix</label>
                        <input id="audit-action" v-model="filters.action" type="text" placeholder="build." class="input w-40 py-1.5 text-xs">
                    </div>
                    <div>
                        <label for="audit-actor" class="label">Actor</label>
                        <input id="audit-actor" v-model="filters.actor" type="text" placeholder="name" class="input w-40 py-1.5 text-xs">
                    </div>
                    <div>
                        <label for="audit-from" class="label">From</label>
                        <input id="audit-from" v-model="filters.from" type="date" class="input w-36 py-1.5 text-xs">
                    </div>
                    <div>
                        <label for="audit-to" class="label">To</label>
                        <input id="audit-to" v-model="filters.to" type="date" class="input w-36 py-1.5 text-xs">
                    </div>
                    <button type="submit" class="btn-secondary px-3 py-1.5 text-xs">Filter</button>
                    <button type="button" class="btn-ghost px-2 py-1.5 text-xs" @click="reset">Reset</button>
                </form>
                <Pagination :links="logs.links" />
            </div>

            <ul class="divide-y divide-slate-800/60">
                <li v-for="log in logs.data" :key="log.id">
                    <button
                        type="button"
                        class="flex w-full items-start justify-between gap-4 px-5 py-3 text-left transition hover:bg-slate-800/30"
                        @click="toggle(log.id)"
                    >
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-mono text-xs font-semibold text-emerald-300">{{ log.action }}</span>
                                <span class="text-[11px] text-slate-500">by {{ log.actorName ?? 'system' }}</span>
                                <span v-if="log.subjectType" class="badge border-slate-700/60 bg-slate-800/50 text-[10px] text-slate-400">
                                    {{ log.subjectType.split('\\').pop() }}{{ log.subjectId ? `#${log.subjectId}` : '' }}
                                </span>
                            </div>
                            <p class="mt-0.5 text-[11px] text-slate-500">
                                {{ formatDateTime(log.createdAt) }} · {{ log.ipAddress ?? 'no ip' }}
                            </p>
                        </div>
                        <code class="hidden shrink-0 font-mono text-[10px] text-slate-600 sm:block" :title="log.hash">
                            {{ log.hash.slice(0, 12) }}…
                        </code>
                    </button>

                    <div v-if="expanded === log.id" class="border-t border-slate-800/60 bg-slate-950/60 px-5 py-4">
                        <p class="text-[11px] uppercase tracking-wider text-slate-500">Hash</p>
                        <p class="mt-1 break-all font-mono text-[11px] text-emerald-300">{{ log.hash }}</p>

                        <p class="mt-3 text-[11px] uppercase tracking-wider text-slate-500">Metadata</p>
                        <pre class="mt-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-400">{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                    </div>
                </li>
                <li v-if="logs.data.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
                    No audit entries match the filters.
                </li>
            </ul>
        </section>
    </AuthenticatedLayout>
</template>
