import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@inertiajs/vue3', () => ({
    Link: {
        name: 'Link',
        props: ['href'],
        template: '<a :href="href"><slot /></a>',
    },
}));

import BuildTable from '@/Components/BuildTable.vue';
import type { Build } from '@/types';

function build(overrides: Partial<Build> = {}): Build {
    return {
        uuid: '12345678-90ab-cdef-1234-567890abcdef',
        status: 'running',
        channel: 'stable',
        stage: 'chroot',
        progress: 42,
        manifest: {},
        exitCode: null,
        errorMessage: null,
        agent: 'agent',
        retryOf: null,
        artifact: null,
        requestedBy: { id: 1, name: 'Ada' },
        can: { cancel: true, retry: false, download: false },
        startedAt: null,
        finishedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('BuildTable', () => {
    it('renders build rows with a shortened UUID link and status', () => {
        const wrapper = mount(BuildTable, { props: { builds: [build()] } });

        expect(wrapper.text()).toContain('12345678');
        expect(wrapper.text()).toContain('Running');
        expect(wrapper.text()).toContain('chroot');
        expect(wrapper.text()).toContain('42%');
        expect(wrapper.text()).toContain('Ada');
        expect(wrapper.find('a[href="/builds/12345678-90ab-cdef-1234-567890abcdef"]').exists()).toBe(true);
    });

    it('shows an empty state when there are no builds', () => {
        const wrapper = mount(BuildTable, { props: { builds: [] } });

        expect(wrapper.text()).toContain('No builds yet.');
    });

    it('hides the requester column in compact mode', () => {
        const wrapper = mount(BuildTable, { props: { builds: [build()], compact: true } });

        expect(wrapper.text()).not.toContain('Requested by');
        expect(wrapper.text()).not.toContain('Ada');
    });
});
