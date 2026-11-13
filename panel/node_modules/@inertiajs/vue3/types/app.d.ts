import { HeadManagerOnUpdateCallback, HeadManagerTitleCallback, Page, PageProps, SharedPageProps } from '@inertiajs/core';
import { DefineComponent, Plugin } from 'vue';
export interface InertiaAppProps<SharedProps extends PageProps = PageProps> {
    initialPage: Page<SharedProps>;
    initialComponent?: DefineComponent;
    resolveComponent?: (name: string) => DefineComponent | Promise<DefineComponent>;
    titleCallback?: HeadManagerTitleCallback;
    onHeadUpdate?: HeadManagerOnUpdateCallback;
}
export type InertiaApp = DefineComponent<InertiaAppProps>;
declare const App: InertiaApp;
export default App;
export declare const plugin: Plugin;
export declare function usePage<TPageProps extends PageProps = PageProps>(): Page<TPageProps & SharedPageProps>;
