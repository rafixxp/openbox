<script setup lang="ts">
import { ref } from 'vue';
import { Head, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import StatusBadge from '@/Components/StatusBadge.vue';
import { formatBytes, formatDateTime } from '@/lib/format';

type SettingsValues = Record<string, unknown>;
type BackupRow = {
    id: number;
    filename: string;
    size: number | null;
    status: string;
    created_at: string;
};

const props = defineProps<{
    values: SettingsValues;
    backups: BackupRow[];
    canManage: boolean;
}>();

const string = (key: string, fallback = ''): string => {
    const value = props.values[key];

    return typeof value === 'string' ? value : fallback;
};

const number = (key: string, fallback = 0): number => {
    const value = props.values[key];

    return typeof value === 'number' ? value : fallback;
};

const bool = (key: string, fallback = false): boolean => {
    const value = props.values[key];

    return typeof value === 'boolean' ? value : fallback;
};

const mailToList = (): string => {
    const value = props.values['notifications.mail_to'];

    return Array.isArray(value) ? value.join(', ') : '';
};

const form = useForm({
    settings: {
        mirror: {
            primary_url: string('mirror.primary_url'),
            fallback_url: string('mirror.fallback_url'),
            publish_path: string('mirror.publish_path'),
        },
        build: {
            debian_suite: string('build.debian_suite', 'bookworm'),
            architecture: string('build.architecture', 'amd64'),
            max_parallel: number('build.max_parallel', 1),
            iso_name: string('build.iso_name'),
        },
        notifications: {
            email_enabled: bool('notifications.email_enabled', true),
            mail_to: mailToList(),
            telegram_enabled: bool('notifications.telegram_enabled', false),
            telegram_chat_id: string('notifications.telegram_chat_id'),
            telegram_bot_token: '',
        },
        gpg: {
            key_id: string('gpg.key_id'),
        },
        backup: {
            retention_days: number('backup.retention_days', 14),
        },
    },
});

const testing = ref<'email' | 'telegram' | null>(null);
const restoreTarget = ref<BackupRow | null>(null);
const restoreConfirm = ref('');
const restoreForm = useForm({ confirm: '' });

function save(): void {
    form
        .transform((data) => ({
            settings: {
                ...data.settings,
                notifications: {
                    ...data.settings.notifications,
                    mail_to: data.settings.notifications.mail_to
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => item.length > 0),
                },
            },
        }))
        .put('/settings', { preserveScroll: true });
}

function testNotification(channel: 'email' | 'telegram'): void {
    testing.value = channel;

    useForm({ channel })
        .post('/settings/notifications/test', {
            preserveScroll: true,
            onFinish: () => {
                testing.value = null;
            },
        });
}

function createBackup(): void {
    useForm({}).post('/settings/backups', { preserveScroll: true });
}

function openRestore(backup: BackupRow): void {
    restoreTarget.value = backup;
    restoreConfirm.value = '';
    restoreForm.confirm = '';
    restoreForm.clearErrors();
}

function submitRestore(): void {
    if (!restoreTarget.value) {
        return;
    }

    restoreForm.post(`/settings/backups/${restoreTarget.value.id}/restore`, {
        preserveScroll: true,
        onSuccess: () => {
            restoreTarget.value = null;
            restoreForm.reset();
        },
    });
}
</script>

<template>
    <Head title="Settings" />

    <AuthenticatedLayout title="Settings">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">System settings</h1>
                <p class="mt-1 text-sm text-slate-500">
                    Secrets are encrypted at rest. GPG private material never leaves the server.
                </p>
            </div>
            <button v-if="canManage" type="submit" form="settings-form" class="btn-primary" :disabled="form.processing">
                {{ form.processing ? 'Saving…' : 'Save settings' }}
            </button>
        </div>

        <form id="settings-form" class="grid gap-5 xl:grid-cols-2" @submit.prevent="save">
            <section class="panel-card p-5">
                <h2 class="text-sm font-semibold text-slate-100">Debian mirror</h2>
                <p class="mt-1 text-xs text-slate-500">Used by the build manifest and apt sources.</p>

                <div class="mt-4 space-y-3">
                    <div>
                        <label for="primary-url" class="label">Primary URL</label>
                        <input id="primary-url" v-model="form.settings.mirror.primary_url" type="url" class="input" :disabled="!canManage">
                        <p v-if="form.errors['settings.mirror.primary_url']" class="error-text">{{ form.errors['settings.mirror.primary_url'] }}</p>
                    </div>
                    <div>
                        <label for="fallback-url" class="label">Fallback URL</label>
                        <input id="fallback-url" v-model="form.settings.mirror.fallback_url" type="url" class="input" :disabled="!canManage">
                        <p v-if="form.errors['settings.mirror.fallback_url']" class="error-text">{{ form.errors['settings.mirror.fallback_url'] }}</p>
                    </div>
                    <div>
                        <label for="publish-path" class="label">Repository publish path</label>
                        <input id="publish-path" v-model="form.settings.mirror.publish_path" type="text" class="input font-mono text-xs" :disabled="!canManage">
                    </div>
                </div>
            </section>

            <section class="panel-card p-5">
                <h2 class="text-sm font-semibold text-slate-100">Build defaults</h2>
                <p class="mt-1 text-xs text-slate-500">The queue worker reads these through the manifest factory.</p>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="suite" class="label">Debian suite</label>
                        <select id="suite" v-model="form.settings.build.debian_suite" class="input" :disabled="!canManage">
                            <option value="bookworm">bookworm</option>
                        </select>
                    </div>
                    <div>
                        <label for="architecture" class="label">Architecture</label>
                        <select id="architecture" v-model="form.settings.build.architecture" class="input" :disabled="!canManage">
                            <option value="amd64">amd64</option>
                            <option value="arm64">arm64</option>
                        </select>
                    </div>
                    <div>
                        <label for="max-parallel" class="label">Max parallel builds</label>
                        <input id="max-parallel" v-model.number="form.settings.build.max_parallel" type="number" min="1" max="10" class="input" :disabled="!canManage">
                        <p v-if="form.errors['settings.build.max_parallel']" class="error-text">{{ form.errors['settings.build.max_parallel'] }}</p>
                    </div>
                    <div>
                        <label for="iso-name" class="label">ISO filename</label>
                        <input id="iso-name" v-model="form.settings.build.iso_name" type="text" class="input font-mono text-xs" :disabled="!canManage">
                    </div>
                </div>
            </section>

            <section class="panel-card p-5">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h2 class="text-sm font-semibold text-slate-100">Notifications</h2>
                        <p class="mt-1 text-xs text-slate-500">Build completion alerts via email and Telegram.</p>
                    </div>
                    <span class="badge border-slate-600/40 bg-slate-800/50 text-slate-400">
                        Token {{ values['notifications.telegram_bot_token_configured'] ? 'configured' : 'missing' }}
                    </span>
                </div>

                <div class="mt-4 space-y-3">
                    <label class="flex items-center gap-2 text-xs text-slate-400">
                        <input v-model="form.settings.notifications.email_enabled" type="checkbox" class="rounded border-slate-700 bg-slate-900 text-emerald-500" :disabled="!canManage">
                        Email notifications enabled
                    </label>
                    <div>
                        <label for="mail-to" class="label">Recipients (comma separated)</label>
                        <input id="mail-to" v-model="form.settings.notifications.mail_to" type="text" class="input" placeholder="ops@example.com" :disabled="!canManage">
                        <p v-if="form.errors['settings.notifications.mail_to']" class="error-text">{{ form.errors['settings.notifications.mail_to'] }}</p>
                    </div>
                    <label class="flex items-center gap-2 text-xs text-slate-400">
                        <input v-model="form.settings.notifications.telegram_enabled" type="checkbox" class="rounded border-slate-700 bg-slate-900 text-emerald-500" :disabled="!canManage">
                        Telegram notifications enabled
                    </label>
                    <div class="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label for="telegram-chat" class="label">Chat ID</label>
                            <input id="telegram-chat" v-model="form.settings.notifications.telegram_chat_id" type="text" class="input" :disabled="!canManage">
                        </div>
                        <div>
                            <label for="telegram-token" class="label">Bot token (leave blank to keep)</label>
                            <input id="telegram-token" v-model="form.settings.notifications.telegram_bot_token" type="password" autocomplete="new-password" class="input" :disabled="!canManage">
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs" :disabled="!canManage || testing !== null" @click="testNotification('email')">
                            Test email
                        </button>
                        <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs" :disabled="!canManage || testing !== null" @click="testNotification('telegram')">
                            Test Telegram
                        </button>
                    </div>
                </div>
            </section>

            <section class="panel-card p-5">
                <h2 class="text-sm font-semibold text-slate-100">Signing & retention</h2>
                <p class="mt-1 text-xs text-slate-500">Package signing uses the server-side GPG keyring.</p>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="gpg-key" class="label">GPG key ID</label>
                        <input id="gpg-key" v-model="form.settings.gpg.key_id" type="text" class="input font-mono text-xs" placeholder="ABCD1234EF567890" :disabled="!canManage">
                        <p v-if="form.errors['settings.gpg.key_id']" class="error-text">{{ form.errors['settings.gpg.key_id'] }}</p>
                    </div>
                    <div>
                        <label for="retention" class="label">Backup retention (days)</label>
                        <input id="retention" v-model.number="form.settings.backup.retention_days" type="number" min="1" max="365" class="input" :disabled="!canManage">
                        <p v-if="form.errors['settings.backup.retention_days']" class="error-text">{{ form.errors['settings.backup.retention_days'] }}</p>
                    </div>
                </div>
            </section>
        </form>

        <section class="panel-card">
            <div class="panel-card-header">
                <div>
                    <h2 class="text-sm font-semibold text-slate-100">Database backups</h2>
                    <p class="text-xs text-slate-500">pg_dump custom format; restore is destructive and admin-only.</p>
                </div>
                <button v-if="canManage" type="button" class="btn-secondary px-3 py-1.5 text-xs" @click="createBackup">
                    Create backup
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="table-base">
                    <thead>
                        <tr>
                            <th>Filename</th>
                            <th>Status</th>
                            <th>Size</th>
                            <th>Created</th>
                            <th v-if="canManage" class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="backup in backups" :key="backup.id">
                            <td class="font-mono text-xs text-slate-300">{{ backup.filename }}</td>
                            <td><StatusBadge :status="backup.status" /></td>
                            <td class="text-xs">{{ formatBytes(backup.size) }}</td>
                            <td class="whitespace-nowrap text-xs text-slate-500">{{ formatDateTime(backup.created_at) }}</td>
                            <td v-if="canManage">
                                <div class="flex justify-end gap-1.5">
                                    <a :href="`/settings/backups/${backup.id}/download`" class="btn-ghost px-2 py-1 text-xs">Download</a>
                                    <button
                                        v-if="backup.status === 'completed'"
                                        type="button"
                                        class="btn-ghost px-2 py-1 text-xs text-rose-400"
                                        @click="openRestore(backup)"
                                    >
                                        Restore
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="backups.length === 0">
                            <td :colspan="canManage ? 5 : 4" class="py-8 text-center text-sm text-slate-500">
                                No backups yet.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <div v-if="restoreTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div class="panel-card w-full max-w-lg bg-slate-900 p-5">
                <h2 class="text-base font-semibold text-rose-300">Restore database</h2>
                <p class="mt-1 text-sm text-slate-400">
                    This runs pg_restore --clean and replaces the current schema data. Type
                    <code class="font-mono text-xs text-slate-200">{{ restoreTarget.filename }}</code>
                    to confirm.
                </p>
                <input v-model="restoreConfirm" type="text" class="input mt-3 font-mono text-xs" :placeholder="restoreTarget.filename">
                <p v-if="restoreForm.errors.confirm" class="error-text">{{ restoreForm.errors.confirm }}</p>
                <div class="mt-4 flex justify-end gap-2">
                    <button type="button" class="btn-secondary" @click="restoreTarget = null">Cancel</button>
                    <button
                        type="button"
                        class="btn-danger"
                        :disabled="restoreConfirm !== restoreTarget.filename || restoreForm.processing"
                        @click="submitRestore"
                    >
                        Restore now
                    </button>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
