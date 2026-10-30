<script setup lang="ts">
import { ref } from 'vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import Modal from '@/Components/Modal.vue';
import Pagination from '@/Components/Pagination.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import type { Paginated, Release } from '@/types';
import { formatDateTime, shortUuid } from '@/lib/format';

defineProps<{
    releases: Paginated<Release>;
    succeededBuilds: Array<{ uuid: string; channel: string; created_at: string }>;
    channels: string[];
    can: { manage: boolean; publish: boolean };
}>();

const showCreate = ref(false);

const form = useForm({
    version: '',
    channel: 'stable',
    codename: 'bookworm',
    notes: '',
    iso_build_uuid: '',
});

function create(): void {
    form.post('/releases', {
        preserveScroll: true,
        onSuccess: () => {
            showCreate.value = false;
            form.reset();
        },
    });
}

function publish(release: Release): void {
    router.post(`/releases/${release.id}/publish`, {}, { preserveScroll: true });
}

function archive(release: Release): void {
    if (!window.confirm(`Archive ${release.channel}/${release.version}?`)) {
        return;
    }
    router.post(`/releases/${release.id}/archive`, {}, { preserveScroll: true });
}

function destroy(release: Release): void {
    if (!window.confirm(`Delete draft ${release.channel}/${release.version}?`)) {
        return;
    }
    router.delete(`/releases/${release.id}`, { preserveScroll: true });
}
</script>

<template>
    <Head title="Releases" />

    <AuthenticatedLayout title="Releases">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">Release channels</h1>
                <p class="mt-1 text-sm text-slate-500">Attach a successful ISO build, publish checksums and sync primary mirrors.</p>
            </div>
            <button v-if="can.manage" type="button" class="btn-primary" @click="showCreate = true">New release</button>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <h2 class="text-sm font-semibold text-slate-100">Published & draft releases</h2>
                <Pagination :links="releases.links" />
            </div>

            <div class="overflow-x-auto">
                <table class="table-base">
                    <thead>
                        <tr>
                            <th>Release</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>Build</th>
                            <th>Checksum</th>
                            <th>Published</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="release in releases.data" :key="release.id">
                            <td>
                                <p class="font-semibold text-slate-100">v{{ release.version }}</p>
                                <p class="text-[11px] text-slate-500">{{ release.codename ?? '—' }}</p>
                            </td>
                            <td class="capitalize">{{ release.channel }}</td>
                            <td><StatusBadge :status="release.status" /></td>
                            <td>
                                <a v-if="release.build" :href="`/builds/${release.build.uuid}`" class="font-mono text-xs text-emerald-300 hover:text-emerald-200">
                                    {{ shortUuid(release.build.uuid) }}
                                </a>
                                <span v-else class="text-xs text-slate-600">No build</span>
                            </td>
                            <td class="max-w-[14rem]">
                                <span v-if="release.checksums.sha256" class="block truncate font-mono text-[10px] text-slate-500">{{ release.checksums.sha256 }}</span>
                                <span v-else class="text-xs text-slate-600">—</span>
                            </td>
                            <td class="whitespace-nowrap text-xs text-slate-500">{{ formatDateTime(release.publishedAt) }}</td>
                            <td>
                                <div class="flex justify-end gap-1.5">
                                    <button
                                        v-if="can.publish && release.status === 'draft'"
                                        type="button"
                                        class="btn-primary px-2 py-1 text-xs"
                                        @click="publish(release)"
                                    >
                                        Publish
                                    </button>
                                    <button
                                        v-if="can.manage && release.status === 'published'"
                                        type="button"
                                        class="btn-ghost px-2 py-1 text-xs"
                                        @click="archive(release)"
                                    >
                                        Archive
                                    </button>
                                    <button
                                        v-if="can.manage && release.status === 'draft'"
                                        type="button"
                                        class="btn-ghost px-2 py-1 text-xs text-rose-400"
                                        @click="destroy(release)"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="releases.data.length === 0">
                            <td colspan="7" class="py-10 text-center text-sm text-slate-500">No releases yet.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <Modal :show="showCreate" title="Create release draft" description="Versions are unique per channel." @close="showCreate = false">
            <form id="create-release" class="space-y-4" @submit.prevent="create">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="release-version" class="label">Version</label>
                        <input id="release-version" v-model="form.version" type="text" class="input" placeholder="1.0.0" required>
                        <p v-if="form.errors.version" class="error-text">{{ form.errors.version }}</p>
                    </div>
                    <div>
                        <label for="release-channel" class="label">Channel</label>
                        <select id="release-channel" v-model="form.channel" class="input">
                            <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                        </select>
                    </div>
                    <div>
                        <label for="release-codename" class="label">Codename</label>
                        <input id="release-codename" v-model="form.codename" type="text" class="input">
                    </div>
                    <div>
                        <label for="release-build" class="label">ISO build</label>
                        <select id="release-build" v-model="form.iso_build_uuid" class="input">
                            <option value="">No build (draft only)</option>
                            <option v-for="build in succeededBuilds" :key="build.uuid" :value="build.uuid">
                                {{ shortUuid(build.uuid) }} · {{ build.channel }}
                            </option>
                        </select>
                        <p v-if="form.errors.iso_build_uuid" class="error-text">{{ form.errors.iso_build_uuid }}</p>
                    </div>
                </div>
                <div>
                    <label for="release-notes" class="label">Notes</label>
                    <textarea id="release-notes" v-model="form.notes" rows="3" class="input" />
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="showCreate = false">Cancel</button>
                <button type="submit" form="create-release" class="btn-primary" :disabled="form.processing">Create draft</button>
            </template>
        </Modal>
    </AuthenticatedLayout>
</template>
