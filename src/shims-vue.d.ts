declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // biome-ignore lint/complexity/noBannedTypes: Vue component type declaration
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}
