<script setup lang="ts">
import { computed } from 'vue';
import { Head, Link } from '@inertiajs/vue3';

const props = defineProps<{
    status: number;
    message?: string | null;
}>();

const titles: Record<number, string> = {
    403: 'Access denied',
    404: 'Not found',
    419: 'Session expired',
    429: 'Too many requests',
    500: 'Server error',
    503: 'Service unavailable',
};

const descriptions: Record<number, string> = {
    403: 'Your role does not include the permission required for this action.',
    404: 'The page or resource you requested does not exist.',
    419: 'Your session token expired. Reload the page and sign in again.',
    429: 'The request rate limit was exceeded. Wait a moment before retrying.',
    500: 'An unexpected error occurred. The incident has been logged.',
    503: 'The panel is temporarily unavailable. Try again shortly.',
};

const title = computed(() => titles[props.status] ?? 'Unexpected error');
const description = computed(() => props.message || descriptions[props.status] || 'Something went wrong.');
</script>

<template>
    <Head :title="title" />

    <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div class="panel-card w-full max-w-md p-8 text-center">
            <p class="font-mono text-5xl font-black text-emerald-400">{{ status }}</p>
            <h1 class="mt-4 text-lg font-semibold text-white">{{ title }}</h1>
            <p class="mt-2 text-sm text-slate-400">{{ description }}</p>

            <div class="mt-6 flex justify-center gap-2">
                <Link href="/" class="btn-primary">Dashboard</Link>
                <Link href="/builds" class="btn-secondary">Builds</Link>
            </div>
        </div>
    </div>
</template>
