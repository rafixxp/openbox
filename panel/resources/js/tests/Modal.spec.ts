import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Modal from '@/Components/Modal.vue';

const global = { stubs: { teleport: true } };

describe('Modal', () => {
    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('renders nothing when hidden', () => {
        const wrapper = mount(Modal, {
            props: { show: false, title: 'Hidden' },
            global,
        });

        expect(wrapper.text()).not.toContain('Hidden');
    });

    it('renders the dialog with title and slot content when shown', () => {
        const wrapper = mount(Modal, {
            props: { show: true, title: 'Queue build', description: 'Async' },
            slots: { default: '<p>Body content</p>' },
            global,
        });

        expect(wrapper.text()).toContain('Queue build');
        expect(wrapper.text()).toContain('Async');
        expect(wrapper.text()).toContain('Body content');
        expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    });

    it('emits close on Escape and when the backdrop is clicked', async () => {
        const wrapper = mount(Modal, {
            props: { show: true, title: 'Dismissable' },
            global,
        });

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('close')).toHaveLength(1);

        await wrapper.find('[role="dialog"]').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(2);
    });

    it('locks body scrolling while open', () => {
        mount(Modal, {
            props: { show: true, title: 'Locking' },
            global,
        });

        expect(document.body.style.overflow).toBe('hidden');
    });
});
