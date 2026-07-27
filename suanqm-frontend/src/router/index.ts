import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../views/Logs.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/images',
    name: 'ImageManagement',
    component: () => import('../views/ImageManagement.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/violations',
    name: 'ViolationManagement',
    component: () => import('../views/ViolationManagement.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/command-logs',
    name: 'CommandLog',
    component: () => import('../views/CommandLog.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth !== false && !userStore.isAuthenticated) {
    return '/login'
  } else if (to.path === '/login' && userStore.isAuthenticated) {
    return '/'
  }
})

export default router
