<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import StatusBadge from '@/Components/StatusBadge.vue';
import type { Build } from '@/types';
import { formatDateTime, shortUuid } from '@/lib/format';

defineProps<{
    builds: Build[];
    compact?: boolean;
}>();
</script>

<template>
    <div class="overflow-x-auto">
        <table class="table-base">
            <thead>
                <tr>
                    <th>Build</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th v-if="!compact">Requested by</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="build in builds" :key="build.uuid">
                    <td>
                        <Link :href="`/builds/${build.uuid}`" class="font-mono text-xs text-emerald-300 hover:text-emerald-200">
                            {{ shortUuid(build.uuid) }}
                        </Link>
                        <p v-if="build.stage" class="mt-0.5 text-[11px] text-slate-500">{{ build.stage }}</p>
                    </td>
                    <td class="capitalize">{{ build.channel }}</td>
                    <td><StatusBadge :status="build.status" /></td>
                    <td>
                        <div class="flex items-center gap-2">
                            <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                                <div
                                    class="h-full rounded-full transition-all"
                                    :class="build.status === 'failed' ? 'bg-rose-400' : 'bg-emerald-400'"
                                    :style="{ width: `${build.progress}%` }"
                                />
                            </div>
                            <span class="text-xs text-slate-500">{{ build.progress }}%</span>
                        </div>
                    </td>
                    <td v-if="!compact" class="text-slate-400">{{ build.requestedBy?.name ?? '—' }}</td>
                    <td class="whitespace-nowrap text-xs text-slate-500">{{ formatDateTime(build.createdAt) }}</td>
                </tr>
                <tr v-if="builds.length === 0">
                    <td :colspan="compact ? 5 : 6" class="py-10 text-center text-sm text-slate-500">
                        No builds yet.
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
