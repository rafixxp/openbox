import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from '@/Components/StatusBadge.vue';

describe('StatusBadge', () => {
    it('renders the friendly label for a known status', () => {
        const wrapper = mount(StatusBadge, { props: { status: 'running' } });

        expect(wrapper.text()).toContain('Running');
        expect(wrapper.find('.animate-pulse').exists()).toBe(true);
    });

    it('renders distinct styles per status', () => {
        const success = mount(StatusBadge, { props: { status: 'succeeded' } });
        const failure = mount(StatusBadge, { props: { status: 'failed' } });

        expect(success.classes().join(' ')).toContain('emerald');
        expect(failure.classes().join(' ')).toContain('rose');
    });

    it('falls back to the raw status when unknown', () => {
        const wrapper = mount(StatusBadge, { props: { status: 'mystery' } });

        expect(wrapper.text()).toContain('mystery');
    });
});
