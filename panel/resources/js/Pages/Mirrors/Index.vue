<script setup lang="ts">
import { ref } from 'vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import Modal from '@/Components/Modal.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import type { Mirror } from '@/types';
import { formatDateTime } from '@/lib/format';

defineProps<{
    mirrors: Mirror[];
    statuses: string[];
    canManage: boolean;
    releases: Array<{ id: number; version: string; channel: string }>;
}>();

const editing = ref<Mirror | null>(null);
const creating = ref(false);
const syncing = ref<Mirror | null>(null);
const syncReleaseId = ref<string>('');

const form = useForm({
    name: '',
    base_url: '',
    sync_target: '',
    region: '',
    status: 'offline',
    is_primary: false,
});

const syncForm = useForm({
    release_id: '',
});

function openCreate(): void {
    editing.value = null;
    form.reset();
    form.clearErrors();
    creating.value = true;
}

function openEdit(mirror: Mirror): void {
    creating.value = false;
    editing.value = mirror;
    form.clearErrors();
    form.name = mirror.name;
    form.base_url = mirror.baseUrl;
    form.sync_target = mirror.syncTarget ?? '';
    form.region = mirror.region ?? '';
    form.status = mirror.status;
    form.is_primary = mirror.isPrimary;
}

function closeForm(): void {
    creating.value = false;
    editing.value = null;
}

function submit(): void {
    const options = {
        preserveScroll: true,
        onSuccess: () => closeForm(),
    };

    if (editing.value) {
        form.put(`/mirrors/${editing.value.id}`, options);

        return;
    }

    form.post('/mirrors', options);
}

function openSync(mirror: Mirror): void {
    syncing.value = mirror;
    syncReleaseId.value = '';
    syncForm.release_id = '';
    syncForm.clearErrors();
}

function submitSync(): void {
    if (!syncing.value) {
        return;
    }

    syncForm
        .transform((data) => ({
            release_id: data.release_id === '' ? undefined : Number(data.release_id),
        }))
        .post(`/mirrors/${syncing.value.id}/sync`, {
            preserveScroll: true,
            onSuccess: () => {
                syncing.value = null;
                syncForm.reset();
            },
        });
}

function check(mirror: Mirror): void {
    router.post(`/mirrors/${mirror.id}/check`, {}, { preserveScroll: true });
}

function destroy(mirror: Mirror): void {
    if (!window.confirm(`Remove mirror ${mirror.name}?`)) {
        return;
    }

    router.delete(`/mirrors/${mirror.id}`, { preserveScroll: true });
}
</script>

<template>
    <Head title="Mirrors" />

    <AuthenticatedLayout title="Mirror management">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">Mirrors</h1>
                <p class="mt-1 text-sm text-slate-500">
                    Health checks and artifact syncs run on the queue. Sync targets are rclone remotes.
                </p>
            </div>
            <button v-if="canManage" type="button" class="btn-primary" @click="openCreate">Add mirror</button>
        </div>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article v-for="mirror in mirrors" :key="mirror.id" class="panel-card flex flex-col p-5">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h2 class="truncate text-sm font-semibold text-slate-100">{{ mirror.name }}</h2>
                        <a
                            :href="mirror.baseUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-1 block truncate text-xs text-emerald-300 hover:text-emerald-200"
                        >
                            {{ mirror.baseUrl }}
                        </a>
                    </div>
                    <StatusBadge :status="mirror.status" />
                </div>

                <dl class="mt-4 space-y-2 text-xs">
                    <div class="flex justify-between gap-3">
                        <dt class="text-slate-500">Region</dt>
                        <dd class="text-slate-300">{{ mirror.region ?? '—' }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                        <dt class="text-slate-500">Primary</dt>
                        <dd :class="mirror.isPrimary ? 'text-emerald-300' : 'text-slate-500'">
                            {{ mirror.isPrimary ? 'Yes' : 'No' }}
                        </dd>
                    </div>
                    <div class="flex justify-between gap-3">
                        <dt class="text-slate-500">Latency</dt>
                        <dd class="text-slate-300">{{ mirror.latencyMs !== null ? `${mirror.latencyMs} ms` : '—' }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                        <dt class="text-slate-500">Last synced</dt>
                        <dd class="text-slate-300">{{ formatDateTime(mirror.lastSyncedAt) }}</dd>
                    </div>
                    <div class="flex justify-between gap-3">
                        <dt class="text-slate-500">Sync target</dt>
                        <dd class="max-w-[60%] truncate font-mono text-slate-400" :title="mirror.syncTarget ?? ''">
                            {{ mirror.syncTarget ?? 'not configured' }}
                        </dd>
                    </div>
                </dl>

                <p v-if="mirror.lastError" class="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                    {{ mirror.lastError }}
                </p>

                <div class="mt-4 flex flex-wrap gap-1.5 border-t border-slate-800/80 pt-4">
                    <button v-if="canManage" type="button" class="btn-secondary px-2 py-1 text-xs" @click="check(mirror)">
                        Check
                    </button>
                    <button v-if="canManage" type="button" class="btn-secondary px-2 py-1 text-xs" @click="openSync(mirror)">
                        Sync
                    </button>
                    <button v-if="canManage" type="button" class="btn-ghost px-2 py-1 text-xs" @click="openEdit(mirror)">
                        Edit
                    </button>
                    <button v-if="canManage" type="button" class="btn-ghost px-2 py-1 text-xs text-rose-400" @click="destroy(mirror)">
                        Remove
                    </button>
                </div>
            </article>

            <p v-if="mirrors.length === 0" class="panel-card p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                No mirrors configured. Add one to publish releases.
            </p>
        </section>

        <Modal
            :show="creating || editing !== null"
            :title="editing ? 'Edit mirror' : 'Add mirror'"
            description="Sync target must be a configured rclone remote, e.g. mirror-eu:/srv/openbox."
            @close="closeForm"
        >
            <form id="mirror-form" class="space-y-4" @submit.prevent="submit">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="mirror-name" class="label">Name</label>
                        <input id="mirror-name" v-model="form.name" type="text" class="input" required>
                        <p v-if="form.errors.name" class="error-text">{{ form.errors.name }}</p>
                    </div>
                    <div>
                        <label for="mirror-region" class="label">Region</label>
                        <input id="mirror-region" v-model="form.region" type="text" class="input" placeholder="eu-central">
                        <p v-if="form.errors.region" class="error-text">{{ form.errors.region }}</p>
                    </div>
                </div>

                <div>
                    <label for="mirror-url" class="label">Base URL</label>
                    <input id="mirror-url" v-model="form.base_url" type="url" class="input" placeholder="https://mirror.example.com/openbox" required>
                    <p v-if="form.errors.base_url" class="error-text">{{ form.errors.base_url }}</p>
                </div>

                <div>
                    <label for="mirror-target" class="label">rclone sync target</label>
                    <input id="mirror-target" v-model="form.sync_target" type="text" class="input font-mono text-xs" placeholder="mirror-eu:/srv/openbox">
                    <p v-if="form.errors.sync_target" class="error-text">{{ form.errors.sync_target }}</p>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="mirror-status" class="label">Status</label>
                        <select id="mirror-status" v-model="form.status" class="input">
                            <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
                        </select>
                        <p v-if="form.errors.status" class="error-text">{{ form.errors.status }}</p>
                    </div>
                    <label class="mt-6 flex items-center gap-2 text-xs text-slate-400">
                        <input v-model="form.is_primary" type="checkbox" class="rounded border-slate-700 bg-slate-900 text-emerald-500">
                        Primary mirror
                    </label>
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="closeForm">Cancel</button>
                <button type="submit" form="mirror-form" class="btn-primary" :disabled="form.processing">
                    {{ form.processing ? 'Saving…' : 'Save mirror' }}
                </button>
            </template>
        </Modal>

        <Modal :show="syncing !== null" title="Sync mirror" description="Optionally restrict the sync to a published release." @close="syncing = null">
            <form id="mirror-sync-form" class="space-y-3" @submit.prevent="submitSync">
                <div>
                    <label for="sync-release" class="label">Release</label>
                    <select id="sync-release" v-model="syncReleaseId" class="input">
                        <option value="">Entire published tree</option>
                        <option v-for="release in releases" :key="release.id" :value="String(release.id)">
                            {{ release.channel }}/{{ release.version }}
                        </option>
                    </select>
                    <p v-if="syncForm.errors.release_id" class="error-text">{{ syncForm.errors.release_id }}</p>
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="syncing = null">Cancel</button>
                <button type="submit" form="mirror-sync-form" class="btn-primary" :disabled="syncForm.processing">
                    Queue sync
                </button>
            </template>
        </Modal>
    </AuthenticatedLayout>
</template>
