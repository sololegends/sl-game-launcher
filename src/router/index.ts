
import VueRouter, { RouteConfig } from "vue-router";
import Vue from "vue";
Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: "/",
    name: "Root"
  },
  {
    path: "/games",
    name: "Games",
    component: () => import("../views/GamesView.vue")
  },
  {
    path: "/splash",
    name: "splash",
    component: () => import("../views/LoadingSplash.vue")
  },
  {
    path: "/locked",
    name: "locked",
    component: () => import("../views/SystemLockedMessage.vue")
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue")
  },
  // Generic page catch all for 404 error
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/components/errors/ErrorPage404.vue")
  }
];

/* global process */
const router = new VueRouter({
  mode: process.env.IS_ELECTRON ? "hash" : "history",
  base: process.env.BASE_URL,
  routes
});

router.beforeEach((to, from, next) => {
  next();
});

export default router;
