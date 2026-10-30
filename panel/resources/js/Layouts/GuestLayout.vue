<script setup lang="ts">
import { usePage } from '@inertiajs/vue3';
import type { SharedProps } from '@/types';

const page = usePage<SharedProps>();
</script>

<template>
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
        <div class="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div class="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-500/5 blur-3xl" />

        <div class="relative w-full max-w-md">
            <div class="mb-8 text-center">
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xl font-black text-emerald-300">
                    O
                </div>
                <h1 class="mt-4 text-xl font-bold tracking-tight text-white">{{ page.props.appName }}</h1>
                <p class="mt-1 text-sm text-slate-500">Minimal Debian Bookworm server image control plane</p>
            </div>

            <div class="panel-card bg-slate-900/80 p-6 backdrop-blur">
                <slot />
            </div>

            <p class="mt-6 text-center text-[11px] text-slate-600">
                Session protected by Sanctum · builds require explicit permission
            </p>
        </div>
    </div>
</template>
