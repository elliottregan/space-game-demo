import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/main",
    },
    {
      path: "/main",
      name: "main",
      component: () => import("./components/MainTab.vue"),
    },
    {
      path: "/strategy",
      name: "strategy",
      component: () => import("./components/StrategyTab.vue"),
    },
    {
      path: "/ui",
      name: "ui-showcase",
      component: () => import("./components/UIShowcase.vue"),
    },
  ],
});

export default router;
