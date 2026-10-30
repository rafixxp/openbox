<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import type { PaginationLink } from '@/types';

const props = defineProps<{
    links: PaginationLink[];
}>();

const decoded = computed(() => props.links.map((link) => ({
    ...link,
    label: link.label
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&amp;/g, '&'),
})));
</script>

<template>
    <nav v-if="decoded.length > 3" class="flex flex-wrap items-center gap-1" aria-label="Pagination">
        <template v-for="(link, index) in decoded" :key="index">
            <Link
                v-if="link.url"
                :href="link.url"
                preserve-scroll
                class="min-w-9 rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium transition"
                :class="link.active
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'"
            >
                {{ link.label }}
            </Link>
            <span
                v-else
                class="min-w-9 rounded-lg border border-slate-800/50 px-2.5 py-1.5 text-center text-xs text-slate-600"
            >
                {{ link.label }}
            </span>
        </template>
    </nav>
</template>
