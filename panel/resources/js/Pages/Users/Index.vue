<script setup lang="ts">
import { ref } from 'vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import Modal from '@/Components/Modal.vue';
import Pagination from '@/Components/Pagination.vue';
import type { Paginated, User } from '@/types';
import { formatDateTime } from '@/lib/format';

defineProps<{
    users: Paginated<User & { createdAt: string | null }>;
    roles: Array<{ name: string; label: string }>;
    canManage: boolean;
}>();

const creating = ref(false);
const editing = ref<(User & { createdAt: string | null }) | null>(null);

const form = useForm({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    roles: [] as string[],
});

function openCreate(): void {
    editing.value = null;
    form.reset();
    form.clearErrors();
    creating.value = true;
}

function openEdit(user: User & { createdAt: string | null }): void {
    creating.value = false;
    form.clearErrors();
    form.name = user.name;
    form.email = user.email;
    form.password = '';
    form.password_confirmation = '';
    form.roles = [...user.roles];
    editing.value = user;
}

function closeForm(): void {
    creating.value = false;
    editing.value = null;
}

function toggleRole(role: string): void {
    if (form.roles.includes(role)) {
        form.roles = form.roles.filter((item) => item !== role);

        return;
    }

    form.roles = [...form.roles, role];
}

function submit(): void {
    const options = {
        preserveScroll: true,
        onSuccess: () => closeForm(),
    };

    if (editing.value) {
        form.put(`/users/${editing.value.id}`, options);

        return;
    }

    form.post('/users', options);
}

function destroy(user: User): void {
    if (!window.confirm(`Delete user ${user.email}?`)) {
        return;
    }

    router.delete(`/users/${user.id}`, { preserveScroll: true });
}
</script>

<template>
    <Head title="Users" />

    <AuthenticatedLayout title="Users & roles">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-lg font-semibold text-white">Users</h1>
                <p class="mt-1 text-sm text-slate-500">
                    Roles grant granular permissions. The last administrator cannot be removed.
                </p>
            </div>
            <button v-if="canManage" type="button" class="btn-primary" @click="openCreate">New user</button>
        </div>

        <section class="panel-card">
            <div class="panel-card-header">
                <h2 class="text-sm font-semibold text-slate-100">{{ users.meta?.total ?? users.data.length }} accounts</h2>
                <Pagination :links="users.links" />
            </div>

            <div class="overflow-x-auto">
                <table class="table-base">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Roles</th>
                            <th>2FA</th>
                            <th>Created</th>
                            <th v-if="canManage" class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="user in users.data" :key="user.id">
                            <td>
                                <p class="font-medium text-slate-100">{{ user.name }}</p>
                                <p class="text-[11px] text-slate-500">{{ user.email }}</p>
                            </td>
                            <td>
                                <div class="flex flex-wrap gap-1">
                                    <span
                                        v-for="role in user.roles"
                                        :key="role"
                                        class="badge border-slate-600/40 bg-slate-800/50 capitalize text-slate-300"
                                    >
                                        {{ role }}
                                    </span>
                                    <span v-if="user.roles.length === 0" class="text-[11px] text-rose-400">No role</span>
                                </div>
                            </td>
                            <td>
                                <span :class="user.twoFactorEnabled ? 'text-emerald-300' : 'text-amber-400'" class="text-xs">
                                    {{ user.twoFactorEnabled ? 'Enabled' : 'Off' }}
                                </span>
                            </td>
                            <td class="whitespace-nowrap text-xs text-slate-500">{{ formatDateTime(user.createdAt) }}</td>
                            <td v-if="canManage">
                                <div class="flex justify-end gap-1.5">
                                    <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="openEdit(user)">Edit</button>
                                    <button type="button" class="btn-ghost px-2 py-1 text-xs text-rose-400" @click="destroy(user)">Delete</button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="users.data.length === 0">
                            <td :colspan="canManage ? 5 : 4" class="py-10 text-center text-sm text-slate-500">No users found.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <Modal
            :show="creating || editing !== null"
            :title="editing ? `Edit ${editing.email}` : 'Create user'"
            description="Passwords must meet the configured policy; they are hashed on the server."
            @close="closeForm"
        >
            <form id="user-form" class="space-y-4" @submit.prevent="submit">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label for="user-name" class="label">Name</label>
                        <input id="user-name" v-model="form.name" type="text" class="input" required autocomplete="off">
                        <p v-if="form.errors.name" class="error-text">{{ form.errors.name }}</p>
                    </div>
                    <div>
                        <label for="user-email" class="label">Email</label>
                        <input id="user-email" v-model="form.email" type="email" class="input" required autocomplete="off">
                        <p v-if="form.errors.email" class="error-text">{{ form.errors.email }}</p>
                    </div>
                    <div>
                        <label for="user-password" class="label">
                            Password <span v-if="editing" class="font-normal normal-case text-slate-500">(leave blank to keep)</span>
                        </label>
                        <input id="user-password" v-model="form.password" type="password" class="input" :required="!editing" autocomplete="new-password">
                        <p v-if="form.errors.password" class="error-text">{{ form.errors.password }}</p>
                    </div>
                    <div>
                        <label for="user-password-confirm" class="label">Confirm password</label>
                        <input id="user-password-confirm" v-model="form.password_confirmation" type="password" class="input" :required="!editing" autocomplete="new-password">
                    </div>
                </div>

                <div>
                    <p class="label">Roles</p>
                    <div class="grid gap-2 sm:grid-cols-3">
                        <label
                            v-for="role in roles"
                            :key="role.name"
                            class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition"
                            :class="form.roles.includes(role.name)
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                : 'border-slate-800 bg-slate-950/50 text-slate-400'"
                        >
                            <input
                                type="checkbox"
                                :checked="form.roles.includes(role.name)"
                                class="rounded border-slate-700 bg-slate-900 text-emerald-500"
                                @change="toggleRole(role.name)"
                            >
                            {{ role.label }}
                        </label>
                    </div>
                    <p v-if="form.errors.roles" class="error-text">{{ form.errors.roles }}</p>
                </div>
            </form>

            <template #footer>
                <button type="button" class="btn-secondary" @click="closeForm">Cancel</button>
                <button type="submit" form="user-form" class="btn-primary" :disabled="form.processing">
                    {{ form.processing ? 'Saving…' : 'Save user' }}
                </button>
            </template>
        </Modal>
    </AuthenticatedLayout>
</template>
