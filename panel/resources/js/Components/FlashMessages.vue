<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { usePage } from '@inertiajs/vue3';
import type { SharedProps } from '@/types';

const page = usePage<SharedProps>();
const dismissedSuccess = ref(false);
const dismissedError = ref(false);

const success = computed(() => page.props.flash?.success ?? null);
const error = computed(() => page.props.flash?.error ?? null);

watch(success, () => { dismissedSuccess.value = false; });
watch(error, () => { dismissedError.value = false; });
</script>

<template>
    <div class="space-y-2">
        <div
            v-if="success && !dismissedSuccess"
            class="flex items-start justify-between gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            role="status"
        >
            <span>{{ success }}</span>
            <button type="button" class="text-emerald-400 hover:text-emerald-200" aria-label="Dismiss" @click="dismissedSuccess = true">✕</button>
        </div>
        <div
            v-if="error && !dismissedError"
            class="flex items-start justify-between gap-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            role="alert"
        >
            <span>{{ error }}</span>
            <button type="button" class="text-rose-400 hover:text-rose-200" aria-label="Dismiss" @click="dismissedError = true">✕</button>
        </div>
    </div>
</template>
