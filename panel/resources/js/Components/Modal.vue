<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

const props = withDefaults(defineProps<{
    show: boolean;
    title?: string;
    description?: string;
    wide?: boolean;
}>(), {
    title: '',
    description: '',
    wide: false,
});

const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && props.show) {
        emit('close');
    }
}

watch(() => props.show, (visible) => {
    if (visible) {
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeydown);
    } else {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKeydown);
    }
}, { immediate: true });

onBeforeUnmount(() => {
    document.body.style.overflow = '';
    window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="show"
                class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
                @click.self="emit('close')"
            >
                <div
                    class="panel-card w-full bg-slate-900"
                    :class="wide ? 'max-w-4xl' : 'max-w-xl'"
                >
                    <div class="panel-card-header">
                        <div>
                            <h2 class="text-base font-semibold text-slate-100">{{ title }}</h2>
                            <p v-if="description" class="mt-0.5 text-xs text-slate-500">{{ description }}</p>
                        </div>
                        <button type="button" class="btn-ghost px-2 py-1" aria-label="Close dialog" @click="emit('close')">
                            ✕
                        </button>
                    </div>
                    <div class="max-h-[70vh] overflow-y-auto p-5">
                        <slot />
                    </div>
                    <div v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
                        <slot name="footer" />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
