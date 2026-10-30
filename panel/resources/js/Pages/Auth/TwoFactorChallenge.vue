<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3';
import GuestLayout from '@/Layouts/GuestLayout.vue';

const form = useForm({ code: '' });

function submit(): void {
    form.post('/two-factor-challenge', {
        onFinish: () => form.reset('code'),
    });
}
</script>

<template>
    <Head title="Two-factor challenge" />

    <GuestLayout>
        <div class="mb-6">
            <h2 class="text-lg font-semibold text-white">Two-factor verification</h2>
            <p class="mt-1 text-sm text-slate-500">
                Enter the 6-digit code from your authenticator app, or a recovery code.
            </p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
            <div>
                <label for="code" class="label">Authentication code</label>
                <input
                    id="code"
                    v-model="form.code"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    autofocus
                    required
                    maxlength="32"
                    class="input text-center font-mono text-lg tracking-[0.4em]"
                    :class="{ 'input-error': form.errors.code }"
                >
                <p v-if="form.errors.code" class="error-text">{{ form.errors.code }}</p>
            </div>

            <button type="submit" class="btn-primary w-full" :disabled="form.processing">
                {{ form.processing ? 'Verifying…' : 'Verify' }}
            </button>
        </form>

        <div class="mt-5 text-center">
            <Link href="/login" class="text-xs text-slate-500 hover:text-slate-300">Back to sign in</Link>
        </div>
    </GuestLayout>
</template>
