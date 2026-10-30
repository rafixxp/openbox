<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import QRCode from 'qrcode';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import type { SharedProps } from '@/types';

const props = defineProps<{
    enabled: boolean;
    pending: boolean;
    secret: string | null;
    otpauthUri: string | null;
    recoveryCodesRemaining: number;
}>();

const page = usePage<SharedProps>();
const canvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

const confirmForm = useForm({ code: '' });
const disableForm = useForm({ password: '', code: '' });
const recoveryForm = useForm({ password: '' });
const setupForm = useForm({});

const recoveryCodes = computed(() => page.props.flash?.recoveryCodes ?? []);

async function renderQr(): Promise<void> {
    if (!props.otpauthUri) {
        return;
    }

    await nextTick();

    if (canvas.value) {
        await QRCode.toCanvas(canvas.value, props.otpauthUri, {
            width: 180,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
        });
    }
}

function confirm(): void {
    confirmForm.post('/profile/two-factor/confirm', {
        preserveScroll: true,
        onFinish: () => confirmForm.reset('code'),
    });
}

function startSetup(): void {
    setupForm.post('/profile/two-factor/enable', { preserveScroll: true });
}

function disable(): void {
    disableForm.delete('/profile/two-factor', {
        preserveScroll: true,
        onFinish: () => disableForm.reset(),
    });
}

function regenerate(): void {
    recoveryForm.post('/profile/two-factor/recovery-codes', {
        preserveScroll: true,
        onFinish: () => recoveryForm.reset(),
    });
}

async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 1500);
}

watch(() => props.otpauthUri, () => { void renderQr(); });
onMounted(() => { void renderQr(); });
</script>

<template>
    <Head title="Two-factor authentication" />

    <AuthenticatedLayout title="Two-factor authentication">
        <div class="grid gap-5 lg:grid-cols-2">
            <section class="panel-card p-5">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base font-semibold text-slate-100">Status</h2>
                        <p class="mt-1 text-sm text-slate-500">
                            TOTP is verified server-side. Recovery codes are shown only once.
                        </p>
                    </div>
                    <span
                        class="badge"
                        :class="enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'"
                    >
                        {{ enabled ? 'Enabled' : 'Not enabled' }}
                    </span>
                </div>

                <dl class="mt-5 space-y-3 text-sm">
                    <div class="flex justify-between border-b border-slate-800 pb-3">
                        <dt class="text-slate-500">Recovery codes remaining</dt>
                        <dd class="font-mono text-slate-200">{{ recoveryCodesRemaining }}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-slate-500">Method</dt>
                        <dd class="text-slate-200">TOTP · SHA1 · 6 digits · 30s</dd>
                    </div>
                </dl>

                <form v-if="enabled" class="mt-6 space-y-3 border-t border-slate-800 pt-5" @submit.prevent="regenerate">
                    <p class="text-xs text-slate-500">Regenerate recovery codes (requires your password).</p>
                    <input
                        v-model="recoveryForm.password"
                        type="password"
                        autocomplete="current-password"
                        placeholder="Current password"
                        class="input"
                        :class="{ 'input-error': recoveryForm.errors.password }"
                    >
                    <p v-if="recoveryForm.errors.password" class="error-text">{{ recoveryForm.errors.password }}</p>
                    <button type="submit" class="btn-secondary" :disabled="recoveryForm.processing">
                        Regenerate recovery codes
                    </button>
                </form>

                <button v-if="!enabled && !pending" type="button" class="btn-primary mt-6" :disabled="setupForm.processing" @click="startSetup">
                    Start setup
                </button>
            </section>

            <section v-if="pending" class="panel-card p-5">
                <h2 class="text-base font-semibold text-slate-100">Scan & confirm</h2>
                <p class="mt-1 text-sm text-slate-500">
                    Scan this QR code with your authenticator, then enter the generated code.
                </p>

                <div class="mt-5 flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-white p-4">
                    <canvas ref="canvas" class="h-[180px] w-[180px]" aria-label="TOTP QR code" />
                </div>

                <div class="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                    <code class="min-w-0 flex-1 truncate font-mono text-xs text-emerald-300">{{ secret }}</code>
                    <button type="button" class="text-xs text-slate-500 hover:text-slate-300" @click="secret && copy(secret)">
                        {{ copied ? 'Copied' : 'Copy' }}
                    </button>
                </div>

                <form class="mt-4 space-y-3" @submit.prevent="confirm">
                    <div>
                        <label for="confirm-code" class="label">Authenticator code</label>
                        <input
                            id="confirm-code"
                            v-model="confirmForm.code"
                            type="text"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="16"
                            class="input text-center font-mono text-lg tracking-[0.35em]"
                            :class="{ 'input-error': confirmForm.errors.code }"
                        >
                        <p v-if="confirmForm.errors.code" class="error-text">{{ confirmForm.errors.code }}</p>
                    </div>
                    <button type="submit" class="btn-primary w-full" :disabled="confirmForm.processing">
                        Confirm and enable
                    </button>
                </form>
            </section>

            <section v-if="enabled" class="panel-card p-5 lg:col-span-2">
                <h2 class="text-base font-semibold text-rose-300">Disable two-factor</h2>
                <p class="mt-1 text-sm text-slate-500">
                    This weakens the account. Confirm with your password and a current TOTP or recovery code.
                </p>

                <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="disable">
                    <div>
                        <label for="disable-password" class="label">Password</label>
                        <input
                            id="disable-password"
                            v-model="disableForm.password"
                            type="password"
                            autocomplete="current-password"
                            class="input"
                            :class="{ 'input-error': disableForm.errors.password }"
                        >
                        <p v-if="disableForm.errors.password" class="error-text">{{ disableForm.errors.password }}</p>
                    </div>
                    <div>
                        <label for="disable-code" class="label">TOTP / recovery code</label>
                        <input
                            id="disable-code"
                            v-model="disableForm.code"
                            type="text"
                            autocomplete="one-time-code"
                            class="input font-mono"
                            :class="{ 'input-error': disableForm.errors.code }"
                        >
                        <p v-if="disableForm.errors.code" class="error-text">{{ disableForm.errors.code }}</p>
                    </div>
                    <div class="sm:col-span-2">
                        <button type="submit" class="btn-danger" :disabled="disableForm.processing">
                            Disable two-factor
                        </button>
                    </div>
                </form>
            </section>
        </div>

        <section v-if="recoveryCodes.length" class="panel-card border-amber-500/30 p-5">
            <h2 class="text-base font-semibold text-amber-200">New recovery codes</h2>
            <p class="mt-1 text-xs text-amber-300/70">Store these offline. They will not be shown again.</p>
            <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <code v-for="code in recoveryCodes" :key="code" class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-center font-mono text-xs text-slate-200">
                    {{ code }}
                </code>
            </div>
            <button type="button" class="btn-secondary mt-4" @click="copy(recoveryCodes.join('\n'))">
                Copy all
            </button>
        </section>
    </AuthenticatedLayout>
</template>
