<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string }>();

const styles: Record<string, { label: string; classes: string; dot: string }> = {
    queued: { label: 'Queued', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
    dispatching: { label: 'Dispatching', classes: 'border-sky-500/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400' },
    running: { label: 'Running', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
    succeeded: { label: 'Succeeded', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
    failed: { label: 'Failed', classes: 'border-rose-500/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
    canceled: { label: 'Canceled', classes: 'border-slate-500/30 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
    completed: { label: 'Completed', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
    uploaded: { label: 'Uploaded', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
    signed: { label: 'Signed', classes: 'border-sky-500/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400' },
    published: { label: 'Published', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
    draft: { label: 'Draft', classes: 'border-slate-500/30 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
    archived: { label: 'Archived', classes: 'border-slate-500/30 bg-slate-500/10 text-slate-400', dot: 'bg-slate-500' },
    online: { label: 'Online', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
    degraded: { label: 'Degraded', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
    offline: { label: 'Offline', classes: 'border-rose-500/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
};

const meta = computed(() => styles[props.status] ?? {
    label: props.status,
    classes: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    dot: 'bg-slate-400',
});
</script>

<template>
    <span class="badge" :class="meta.classes">
        <span class="h-1.5 w-1.5 rounded-full" :class="meta.dot" />
        {{ meta.label }}
    </span>
</template>
