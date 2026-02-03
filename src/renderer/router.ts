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
      path: "/colony",
      name: "colony",
      component: () => import("./components/ColonyView/ColonyViewTab.vue"),
    },
    {
      path: "/politics",
      name: "politics",
      component: () => import("./components/PoliticsTab.vue"),
    },
    {
      path: "/research",
      name: "research",
      component: () => import("./components/ResearchTab.vue"),
    },
    {
      path: "/operations",
      name: "operations",
      component: () => import("./components/OperationsPage/OperationsPage.vue"),
    },
    {
      path: "/base",
      name: "base",
      component: () => import("./components/BaseTab.vue"),
    },
    {
      path: "/ui",
      name: "ui-showcase",
      component: () => import("./components/UIShowcase.vue"),
    },
  ],
});

export default router;
