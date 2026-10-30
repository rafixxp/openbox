<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import Modal from '@/Components/Modal.vue';
import Pagination from '@/Components/Pagination.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import type { Package, Paginated } from '@/types';
import { formatBytes, formatDateTime } from '@/lib/format';

const props = defineProps<{
    packages: Paginated<Package>;
    filters: { q?: string | null; channel?: string | null; status?: string | null };
    channels: string[];
    statuses: string[];
    can: { create: boolean; update: boolean; delete: boolean; sign: boolean };
}>();

const filters = reactive({
    q: props.filters.q ?? '',
    channel: props.filters.channel ?? '',
    status: props.filters.status ?? '',
});

const showUpload = ref(false);
const editing = ref<Package | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const uploadForm = useForm({
    artifact: null as File | null,
    name: '',
    version: '',
    architecture: 'amd64',
    channel: 'stable',
    component: 'main',
    description: '',
    dependsText: '',
});

const editForm = useForm({
    name: '',
    version: '',
    architecture: 'amd64',
    channel: 'stable',
    component: 'main',
    section: '',
    description: '',
    dependsText: '',
});

function applyFilters(): void {
    router.get('/packages', {
        q: filters.q || undefined,
        channel: filters.channel || undefined,
        status: filters.status || undefined,
    }, { preserveState: true, preserveScroll: true, replace: true });
}

function onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    uploadForm.artifact = input.files?.[0] ?? null;
}

function upload(): void {
    uploadForm
        .transform((data) => ({
            ...data,
            depends: data.dependsText.split('\n').map((line) => line.trim()).filter(Boolean),
        }))
        .post('/packages', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                showUpload.value = false;
                uploadForm.reset();
                if (fileInput.value) {
                    fileInput.value.value = '';
                }
            },
        });
}

function openEdit(item: Package): void {
    editing.value = item;
    editForm.name = item.name;
    editForm.version = item.version;
    editForm.architecture = item.architecture;
    editForm.channel = item.channel;
    editForm.component = item.component;
    editForm.section = item.section ?? '';
    editForm.description = item.description ?? '';
    editForm.dependsText = item.depends.join('\n');
}

function saveEdit(): void {
    if (!editing.value) {
        return;
    }

    editForm
        .transform((data) => ({
            ...data,
            depends: data.dependsText.split('\n').map((line) => line.trim()).filter(Boolean),
        }))
        .put(`/packages/${editing.value.id}`, {
            preserveScroll: true,
            onSuccess: () => { editing.value = null; },
        });
}

function sign(item: Package): void {
    router.post(`/packages/${item.id}/sign`, {}, { preserveScroll: true });
}

function destroy(item: Package): void {
    if (!window.confirm(`Delete ${item.name} ${item.version}? The artifact will be removed from object storage.`)) {
        return;
    }

    router.delete(`/packages/${item.id}`, { preserveScroll: true });
}
</script>

<template>
    <Head title="Packages" />

    <AuthenticatedLayout title="Package management">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">Debian packages</h1>
                <p class="mt-1 text-sm text-slate-500">Upload .deb artifacts, inspect control metadata and sign with the server GPG key.</p>
            </div>
            <button v-if="can.create" type="button" class="btn-primary" @click="showUpload = true">Upload .deb</button>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <div class="flex flex-wrap gap-2">
                    <input v-model="filters.q" type="search" placeholder="Search package…" class="input w-56 py-1.5 text-xs" @keyup.enter="applyFilters">
                    <select v-model="filters.channel" class="input w-auto py-1.5 text-xs" aria-label="Channel" @change="applyFilters">
                        <option value="">All channels</option>
                        <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                    </select>
                    <select v-model="filters.status" class="input w-auto py-1.5 text-xs" aria-label="Status" @change="applyFilters">
                        <option value="">All statuses</option>
                        <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
                    </select>
                    <button type="button" class="btn-secondary px-3 py-1.5 text-xs" @click="applyFilters">Filter</button>
                </div>
                <Pagination :links="packages.links" />
            </div>

            <div class="overflow-x-auto">
                <table class="table-base">
                    <thead>
                        <tr>
                            <th>Package</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>Size</th>
                            <th>Signature</th>
                            <th>Uploaded</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in packages.data" :key="item.id">
                            <td>
                                <p class="font-medium text-slate-100">{{ item.name }}</p>
                                <p class="font-mono text-[11px] text-slate-500">{{ item.version }} · {{ item.architecture }}</p>
                                <p v-if="item.description" class="mt-0.5 max-w-md truncate text-[11px] text-slate-600">{{ item.description }}</p>
                            </td>
                            <td class="capitalize">{{ item.channel }}</td>
                            <td><StatusBadge :status="item.status" /></td>
                            <td class="whitespace-nowrap text-xs">{{ formatBytes(item.size) }}</td>
                            <td>
                                <span v-if="item.gpgKeyId" class="font-mono text-[11px] text-emerald-300">{{ item.gpgKeyId }}</span>
                                <span v-else class="text-[11px] text-amber-400">Unsigned</span>
                            </td>
                            <td class="whitespace-nowrap text-xs text-slate-500">{{ formatDateTime(item.createdAt) }}</td>
                            <td>
                                <div class="flex justify-end gap-1.5">
                                    <a :href="`/packages/${item.id}/download`" class="btn-ghost px-2 py-1 text-xs">Download</a>
                                    <button v-if="can.sign && item.status !== 'signed'" type="button" class="btn-secondary px-2 py-1 text-xs" @click="sign(item)">Sign</button>
                                    <button v-if="can.update" type="button" class="btn-ghost px-2 py-1 text-xs" @click="openEdit(item)">Edit</button>
                                    <button v-if="can.delete" type="button" class="btn-ghost px-2 py-1 text-xs text-rose-400" @click="destroy(item)">Delete</button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="packages.data.length === 0">
                            <td colspan="7" class="py-10 text-center text-sm text-slate-500">No packages uploaded yet.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <Modal :show="showUpload" title="Upload package" description="Artifacts go to S3/MinIO; signing happens server-side." @close="showUpload = false">
            <form id="upload-package" class="space-y-4" @submit.prevent="upload">
                <div>
                    <label for="artifact" class="label">.deb artifact</label>
                    <input id="artifact" ref="fileInput" type="file" accept=".deb" required class="input file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200" @change="onFile">
                    <p v-if="uploadForm.errors.artifact" class="error-text">{{ uploadForm.errors.artifact }}</p>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="pkg-name" class="label">Name (optional)</label>
                        <input id="pkg-name" v-model="uploadForm.name" type="text" class="input" placeholder="read from control">
                        <p v-if="uploadForm.errors.name" class="error-text">{{ uploadForm.errors.name }}</p>
                    </div>
                    <div>
                        <label for="pkg-version" class="label">Version (optional)</label>
                        <input id="pkg-version" v-model="uploadForm.version" type="text" class="input" placeholder="read from control">
                        <p v-if="uploadForm.errors.version" class="error-text">{{ uploadForm.errors.version }}</p>
                    </div>
                    <div>
                        <label for="pkg-arch" class="label">Architecture</label>
                        <select id="pkg-arch" v-model="uploadForm.architecture" class="input">
                            <option value="amd64">amd64</option>
                            <option value="arm64">arm64</option>
                            <option value="all">all</option>
                        </select>
                    </div>
                    <div>
                        <label for="pkg-channel" class="label">Channel</label>
                        <select id="pkg-channel" v-model="uploadForm.channel" class="input">
                            <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label for="pkg-description" class="label">Description</label>
                    <textarea id="pkg-description" v-model="uploadForm.description" rows="2" class="input" />
                </div>

                <div>
                    <label for="pkg-depends" class="label">Dependencies (one per line)</label>
                    <textarea id="pkg-depends" v-model="uploadForm.dependsText" rows="3" class="input font-mono text-xs" placeholder="libc6 (>= 2.36)" />
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="showUpload = false">Cancel</button>
                <button type="submit" form="upload-package" class="btn-primary" :disabled="uploadForm.processing">
                    {{ uploadForm.processing ? 'Uploading…' : 'Upload' }}
                </button>
            </template>
        </Modal>

        <Modal :show="editing !== null" title="Edit package metadata" @close="editing = null">
            <form id="edit-package" class="space-y-4" @submit.prevent="saveEdit">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label class="label">Name</label>
                        <input v-model="editForm.name" type="text" class="input" required>
                        <p v-if="editForm.errors.name" class="error-text">{{ editForm.errors.name }}</p>
                    </div>
                    <div>
                        <label class="label">Version</label>
                        <input v-model="editForm.version" type="text" class="input" required>
                        <p v-if="editForm.errors.version" class="error-text">{{ editForm.errors.version }}</p>
                    </div>
                    <div>
                        <label class="label">Channel</label>
                        <select v-model="editForm.channel" class="input">
                            <option v-for="channel in channels" :key="channel" :value="channel">{{ channel }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="label">Section</label>
                        <input v-model="editForm.section" type="text" class="input">
                    </div>
                </div>
                <div>
                    <label class="label">Description</label>
                    <textarea v-model="editForm.description" rows="3" class="input" />
                </div>
                <div>
                    <label class="label">Dependencies</label>
                    <textarea v-model="editForm.dependsText" rows="3" class="input font-mono text-xs" />
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="editing = null">Cancel</button>
                <button type="submit" form="edit-package" class="btn-primary" :disabled="editForm.processing">Save</button>
            </template>
        </Modal>
    </AuthenticatedLayout>
</template>
