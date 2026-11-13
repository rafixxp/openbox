import { createHeadManager, Page, PageHandler, PageProps, router, SharedPageProps } from '@inertiajs/core';
import { DefineComponent } from 'vue';
import useForm from './useForm';
export type VuePageHandlerArgs = Parameters<PageHandler<DefineComponent>>[0];
export type VueInertiaAppConfig = {};
declare module '@inertiajs/core' {
    interface Router {
        form: typeof useForm;
    }
}
declare module 'vue' {
    interface ComponentCustomProperties {
        $inertia: typeof router;
        $page: Page<PageProps & SharedPageProps>;
        $headManager: ReturnType<typeof createHeadManager>;
    }
    interface ComponentCustomOptions {
        remember?: string | string[] | {
            data: string | string[];
            key?: string | (() => string);
        };
    }
}
