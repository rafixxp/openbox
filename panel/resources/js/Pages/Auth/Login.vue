<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3';
import GuestLayout from '@/Layouts/GuestLayout.vue';

defineProps<{ status?: string | null }>();

const form = useForm({
    email: '',
    password: '',
    remember: false,
});

function submit(): void {
    form.post('/login', {
        onFinish: () => form.reset('password'),
    });
}
</script>

<template>
    <Head title="Sign in" />

    <GuestLayout>
        <div class="mb-6">
            <h2 class="text-lg font-semibold text-white">Sign in</h2>
            <p class="mt-1 text-sm text-slate-500">Use your panel account. Login is rate limited.</p>
        </div>

        <div v-if="status" class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {{ status }}
        </div>

        <form class="space-y-4" @submit.prevent="submit">
            <div>
                <label for="email" class="label">Email</label>
                <input
                    id="email"
                    v-model="form.email"
                    type="email"
                    autocomplete="username"
                    autofocus
                    required
                    class="input"
                    :class="{ 'input-error': form.errors.email }"
                >
                <p v-if="form.errors.email" class="error-text">{{ form.errors.email }}</p>
            </div>

            <div>
                <label for="password" class="label">Password</label>
                <input
                    id="password"
                    v-model="form.password"
                    type="password"
                    autocomplete="current-password"
                    required
                    class="input"
                    :class="{ 'input-error': form.errors.password }"
                >
                <p v-if="form.errors.password" class="error-text">{{ form.errors.password }}</p>
            </div>

            <label class="flex items-center gap-2 text-xs text-slate-400">
                <input v-model="form.remember" type="checkbox" class="rounded border-slate-700 bg-slate-900 text-emerald-500">
                Remember this browser
            </label>

            <button type="submit" class="btn-primary w-full" :disabled="form.processing">
                {{ form.processing ? 'Signing in…' : 'Sign in' }}
            </button>
        </form>
    </GuestLayout>
</template>
