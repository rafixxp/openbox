<script setup lang="ts">
withDefaults(defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    tone?: 'default' | 'success' | 'warning' | 'danger';
}>(), {
    hint: '',
    tone: 'default',
});

const tones: Record<string, string> = {
    default: 'text-slate-100',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-rose-300',
};
</script>

<template>
    <div class="panel-card p-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">{{ label }}</p>
        <p class="mt-2 text-2xl font-bold" :class="tones[tone]">{{ value }}</p>
        <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
    </div>
</template>
