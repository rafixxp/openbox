<script setup lang="ts">
import { computed, ref } from 'vue';
import { Link, router, usePage } from '@inertiajs/vue3';
import FlashMessages from '@/Components/FlashMessages.vue';
import type { SharedProps } from '@/types';

withDefaults(defineProps<{ title?: string }>(), { title: '' });

const page = usePage<SharedProps>();
const mobileOpen = ref(false);

const user = computed(() => page.props.auth?.user ?? null);
const permissions = computed(() => user.value?.permissions ?? []);

const navItems = computed(() => [
    { label: 'Dashboard', href: '/', permission: 'dashboard.view' },
    { label: 'Builds', href: '/builds', permission: 'builds.view' },
    { label: 'Packages', href: '/packages', permission: 'packages.view' },
    { label: 'Releases', href: '/releases', permission: 'releases.view' },
    { label: 'Mirrors', href: '/mirrors', permission: 'mirrors.view' },
    { label: 'Users', href: '/users', permission: 'users.view' },
    { label: 'Settings', href: '/settings', permission: 'settings.view' },
    { label: 'Audit trail', href: '/audit-logs', permission: 'audit.view' },
].filter((item) => permissions.value.includes(item.permission) || user.value?.roles.includes('admin')));

const initials = computed(() => (user.value?.name ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase());

function isActive(href: string): boolean {
    if (href === '/') {
        return page.url === '/';
    }

    return page.url.startsWith(href);
}

function logout(): void {
    router.post('/logout');
}
</script>

<template>
    <div class="min-h-screen bg-slate-950">
        <div
            v-if="mobileOpen"
            class="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
            @click="mobileOpen = false"
        />

        <aside
            class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/80 bg-slate-900/95 transition-transform lg:translate-x-0"
            :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
        >
            <div class="flex h-16 items-center gap-3 border-b border-slate-800/80 px-5">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm font-black text-emerald-300">
                    O
                </div>
                <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-white">{{ page.props.appName }}</p>
                    <p class="text-[10px] uppercase tracking-widest text-slate-500">Build control</p>
                </div>
            </div>

            <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                <Link
                    v-for="item in navItems"
                    :key="item.href"
                    :href="item.href"
                    class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
                    :class="isActive(item.href)
                        ? 'bg-emerald-500/10 font-semibold text-emerald-300'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'"
                    @click="mobileOpen = false"
                >
                    <span
                        class="h-2 w-2 rounded-full transition"
                        :class="isActive(item.href) ? 'bg-emerald-400' : 'bg-slate-700 group-hover:bg-slate-500'"
                    />
                    {{ item.label }}
                </Link>
            </nav>

            <div class="border-t border-slate-800/80 p-3">
                <Link
                    href="/profile/two-factor"
                    class="mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
                >
                    <span>Two-factor auth</span>
                    <span :class="user?.twoFactorEnabled ? 'text-emerald-400' : 'text-amber-400'">
                        {{ user?.twoFactorEnabled ? 'On' : 'Off' }}
                    </span>
                </Link>
                <div class="flex items-center gap-3 rounded-lg bg-slate-950/60 p-3">
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                        {{ initials }}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-semibold text-slate-200">{{ user?.name }}</p>
                        <p class="truncate text-[11px] text-slate-500">{{ user?.email }}</p>
                    </div>
                    <button type="button" class="text-xs text-slate-500 hover:text-rose-300" title="Log out" @click="logout">
                        Exit
                    </button>
                </div>
            </div>
        </aside>

        <div class="lg:pl-64">
            <header class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-950/80 px-4 backdrop-blur sm:px-6">
                <div class="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        class="btn-secondary px-2.5 py-1.5 lg:hidden"
                        aria-label="Open navigation"
                        @click="mobileOpen = true"
                    >
                        ☰
                    </button>
                    <slot name="header">
                        <h1 class="truncate text-sm font-semibold text-slate-200">{{ title }}</h1>
                    </slot>
                </div>

                <div class="flex items-center gap-3">
                    <div class="hidden items-center gap-1.5 rounded-full border border-slate-800 px-3 py-1 text-[11px] text-slate-500 sm:flex">
                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {{ page.props.notifications?.unread ?? 0 }} unread
                    </div>
                    <Link href="/builds" class="btn-secondary px-3 py-1.5 text-xs">Builds</Link>
                </div>
            </header>

            <main class="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <FlashMessages />
                <slot />
            </main>
        </div>
    </div>
</template>
