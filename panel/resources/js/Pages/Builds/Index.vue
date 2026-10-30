<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import BuildTable from '@/Components/BuildTable.vue';
import Modal from '@/Components/Modal.vue';
import Pagination from '@/Components/Pagination.vue';
import type { Build, Paginated } from '@/types';

const props = defineProps<{
    builds: Paginated<Build>;
    filters: { status?: string | null; channel?: string | null };
    channels: string[];
    statuses: string[];
    activeCount: number;
    canTrigger: boolean;
}>();

const filters = reactive({
    status: props.filters.status ?? '',
    channel: props.filters.channel ?? '',
});

const showTrigger = ref(false);

const form = useForm({
    channel: 'stable',
    clean: false,
    include_panel_installer: false,
    notes: '',
    idempotency_key: crypto.randomUUID(),
});

function applyFilters(): void {
    router.get('/builds', {
        status: filters.status || undefined,
        channel: filters.channel || undefined,
    }, { preserveState: true, preserveScroll: true, replace: true });
}

function triggerBuild(): void {
    form.post('/builds', {
        preserveScroll: true,
        onSuccess: () => {
            showTrigger.value = false;
            form.reset('notes', 'clean', 'include_panel_installer');
            form.idempotency_key = crypto.randomUUID();
        },
    });
}
</script>

<template>
    <Head title="Builds" />

    <AuthenticatedLayout title="Build pipeline">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">ISO builds</h1>
                <p class="mt-1 text-sm text-slate-500">
                    Queued through Redis/Horizon. live-build never runs inside the web container.
                </p>
            </div>
            <div class="flex items-center gap-2">
                <span v-if="activeCount > 0" class="badge border-amber-500/30 bg-amber-500/10 text-amber-300">
                    {{ activeCount }} active
                </span>
                <button v-if="canTrigger" type="button" class="btn-primary" @click="showTrigger = true">
                    Build ISO
                </button>
            </div>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <div class="flex flex-wrap gap-2">
                    <select v-model="filters.status" class="input w-auto min-w-36 py-1.5 text-xs" aria-label="Filter by status" @change="applyFilters">
                        <option value="">All statuses</option>
                        <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
                    </select>
                    <select v-model="filters.channel" class="input w-auto min-w-32 py-1.5 text-xs" aria-label="Filter by channel" @change="applyFilters">
                        <option value="">All channels</option>
                        <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                    </select>
                </div>
                <Pagination :links="builds.links" />
            </div>

            <BuildTable :builds="builds.data" />
        </section>

        <Modal
            :show="showTrigger"
            title="Queue an ISO build"
            description="The manifest is persisted in PostgreSQL and sent to the build worker."
            @close="showTrigger = false"
        >
            <form id="trigger-build-form" class="space-y-4" @submit.prevent="triggerBuild">
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="channel" class="label">Release channel</label>
                        <select id="channel" v-model="form.channel" class="input">
                            <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                        </select>
                        <p v-if="form.errors.channel" class="error-text">{{ form.errors.channel }}</p>
                    </div>
                    <div>
                        <label for="build-notes" class="label">Notes (optional)</label>
                        <input id="build-notes" v-model="form.notes" type="text" maxlength="2000" class="input" placeholder="Release candidate 2">
                        <p v-if="form.errors.notes" class="error-text">{{ form.errors.notes }}</p>
                    </div>
                </div>

                <label class="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <input v-model="form.clean" type="checkbox" class="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500">
                    <span>
                        <span class="block text-sm text-slate-200">Clean live-build first</span>
                        <span class="block text-xs text-slate-500">Runs lb clean inside the isolated workspace. Slower but reproducible.</span>
                    </span>
                </label>

                <label class="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <input v-model="form.include_panel_installer" type="checkbox" class="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500">
                    <span>
                        <span class="block text-sm text-slate-200">Include install_panel_en.sh</span>
                        <span class="block text-xs text-slate-500">
                            Stages the allowlisted installer into the chroot hook in an isolated workspace. Never executed on the panel host.
                        </span>
                    </span>
                </label>

                <p class="text-xs text-slate-500">
                    A random idempotency key is attached to this request to avoid duplicate builds.
                </p>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="showTrigger = false">Cancel</button>
                <button type="submit" form="trigger-build-form" class="btn-primary" :disabled="form.processing">
                    {{ form.processing ? 'Queuing…' : 'Queue build' }}
                </button>
            </template>
        </Modal>
    </AuthenticatedLayout>
</template>
