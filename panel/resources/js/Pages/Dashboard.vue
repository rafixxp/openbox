<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import BuildTable from '@/Components/BuildTable.vue';
import StatCard from '@/Components/StatCard.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import type { Build } from '@/types';
import { formatDateTime, formatDuration } from '@/lib/format';

defineProps<{
    metrics: {
        activeBuilds: number;
        successRate: number;
        averageBuildSeconds: number;
        publishedReleases: number;
        packages: number;
        onlineMirrors: number;
        totalMirrors: number;
    };
    recentBuilds: Build[];
    mirrors: Array<{
        id: number;
        name: string;
        status: string;
        last_synced_at: string | null;
        latency_ms: number | null;
    }>;
    notifications: Array<{
        id: number;
        channel: string;
        subject: string;
        sent_at: string | null;
        error: string | null;
        created_at: string;
    }>;
    canTrigger: boolean;
}>();
</script>

<template>
    <Head title="Dashboard" />

    <AuthenticatedLayout>
        <template #header>
            <div>
                <h1 class="text-sm font-semibold text-slate-200">Operations overview</h1>
                <p class="text-[11px] text-slate-500">Debian Bookworm minimal server image</p>
            </div>
        </template>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active builds" :value="metrics.activeBuilds" hint="Queued, dispatching or running" :tone="metrics.activeBuilds > 0 ? 'warning' : 'default'" />
            <StatCard label="Success rate (30d)" :value="`${metrics.successRate}%`" hint="Finished builds only" :tone="metrics.successRate >= 80 ? 'success' : 'warning'" />
            <StatCard label="Average build" :value="formatDuration(metrics.averageBuildSeconds)" hint="Last 50 completed builds" />
            <StatCard label="Published releases" :value="metrics.publishedReleases" :hint="`${metrics.packages} packages indexed`" />
        </section>

        <div class="grid gap-5 xl:grid-cols-3">
            <section class="panel-card xl:col-span-2">
                <div class="panel-card-header">
                    <div>
                        <h2 class="text-sm font-semibold text-slate-100">Recent builds</h2>
                        <p class="text-xs text-slate-500">Streaming logs and artifact downloads</p>
                    </div>
                    <div class="flex gap-2">
                        <Link v-if="canTrigger" href="/builds" class="btn-primary px-3 py-1.5 text-xs">New build</Link>
                        <Link href="/builds" class="btn-secondary px-3 py-1.5 text-xs">All builds</Link>
                    </div>
                </div>
                <BuildTable :builds="recentBuilds" compact />
            </section>

            <section class="panel-card">
                <div class="panel-card-header">
                    <div>
                        <h2 class="text-sm font-semibold text-slate-100">Mirrors</h2>
                        <p class="text-xs text-slate-500">{{ metrics.onlineMirrors }}/{{ metrics.totalMirrors }} online</p>
                    </div>
                    <Link href="/mirrors" class="text-xs text-slate-500 hover:text-slate-300">Manage</Link>
                </div>
                <ul class="divide-y divide-slate-800/60">
                    <li v-for="mirror in mirrors" :key="mirror.id" class="flex items-center justify-between gap-3 px-5 py-3">
                        <div class="min-w-0">
                            <p class="truncate text-sm text-slate-200">{{ mirror.name }}</p>
                            <p class="text-[11px] text-slate-500">
                                {{ mirror.latency_ms ? `${mirror.latency_ms} ms` : 'No latency' }}
                                · {{ mirror.last_synced_at ? formatDateTime(mirror.last_synced_at) : 'Never synced' }}
                            </p>
                        </div>
                        <StatusBadge :status="mirror.status" />
                    </li>
                    <li v-if="mirrors.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">
                        No mirrors configured.
                    </li>
                </ul>
            </section>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <div>
                    <h2 class="text-sm font-semibold text-slate-100">Notification activity</h2>
                    <p class="text-xs text-slate-500">Email and Telegram delivery attempts</p>
                </div>
            </div>
            <ul class="divide-y divide-slate-800/60">
                <li v-for="notification in notifications" :key="notification.id" class="flex items-start justify-between gap-4 px-5 py-3">
                    <div class="min-w-0">
                        <p class="truncate text-sm text-slate-200">{{ notification.subject }}</p>
                        <p class="mt-0.5 text-[11px] text-slate-500">
                            {{ notification.channel }} · {{ formatDateTime(notification.created_at) }}
                        </p>
                        <p v-if="notification.error" class="mt-1 text-[11px] text-rose-400">{{ notification.error }}</p>
                    </div>
                    <span
                        class="badge"
                        :class="notification.sent_at
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-600/30 bg-slate-700/10 text-slate-400'"
                    >
                        {{ notification.sent_at ? 'Sent' : 'Pending' }}
                    </span>
                </li>
                <li v-if="notifications.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">
                    No notifications yet. Build completions will appear here.
                </li>
            </ul>
        </section>
    </AuthenticatedLayout>
</template>
