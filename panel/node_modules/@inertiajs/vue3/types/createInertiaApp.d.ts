import { CreateInertiaAppOptionsForCSR, CreateInertiaAppOptionsForSSR, InertiaAppSSRResponse, PageProps, SharedPageProps } from '@inertiajs/core';
import { DefineComponent, Plugin, App as VueApp } from 'vue';
import { InertiaApp, InertiaAppProps } from './app';
import { VueInertiaAppConfig } from './types';
type ComponentResolver = (name: string) => DefineComponent | Promise<DefineComponent> | {
    default: DefineComponent;
};
type SetupOptions<ElementType, SharedProps extends PageProps> = {
    el: ElementType;
    App: InertiaApp;
    props: InertiaAppProps<SharedProps>;
    plugin: Plugin;
};
type InertiaAppOptionsForCSR<SharedProps extends PageProps> = CreateInertiaAppOptionsForCSR<SharedProps, ComponentResolver, SetupOptions<HTMLElement, SharedProps>, void, VueInertiaAppConfig>;
type InertiaAppOptionsForSSR<SharedProps extends PageProps> = CreateInertiaAppOptionsForSSR<SharedProps, ComponentResolver, SetupOptions<null, SharedProps>, VueApp, VueInertiaAppConfig> & {
    render: (app: VueApp) => Promise<string>;
};
export default function createInertiaApp<SharedProps extends PageProps = PageProps & SharedPageProps>(options: InertiaAppOptionsForCSR<SharedProps>): Promise<void>;
export default function createInertiaApp<SharedProps extends PageProps = PageProps & SharedPageProps>(options: InertiaAppOptionsForSSR<SharedProps>): Promise<InertiaAppSSRResponse>;
export {};
