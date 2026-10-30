import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@inertiajs/vue3', () => ({
    Link: {
        name: 'Link',
        props: ['href', 'preserveScroll'],
        template: '<a :href="href"><slot /></a>',
    },
}));

import Pagination from '@/Components/Pagination.vue';
import type { PaginationLink } from '@/types';

const links: PaginationLink[] = [
    { url: '?page=1', label: '&laquo; Previous', active: false },
    { url: '?page=1', label: '1', active: true },
    { url: '?page=2', label: '2', active: false },
    { url: null, label: '...', active: false },
    { url: '?page=2', label: 'Next &raquo;', active: false },
];

describe('Pagination', () => {
    it('renders links and decodes HTML entities', () => {
        const wrapper = mount(Pagination, { props: { links } });

        expect(wrapper.find('nav').exists()).toBe(true);
        expect(wrapper.text()).toContain('« Previous');
        expect(wrapper.text()).toContain('Next »');
    });

    it('marks the active page and renders disabled links as spans', () => {
        const wrapper = mount(Pagination, { props: { links } });
        const anchors = wrapper.findAll('a');
        const spans = wrapper.findAll('span');

        expect(anchors).toHaveLength(4);
        expect(spans).toHaveLength(1);
        expect(wrapper.find('a.border-emerald-500\\/50').text()).toBe('1');
    });

    it('hides itself when there are too few links', () => {
        const wrapper = mount(Pagination, { props: { links: links.slice(0, 2) } });

        expect(wrapper.find('nav').exists()).toBe(false);
    });
});
