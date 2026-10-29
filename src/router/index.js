import { createRouter, createWebHistory } from 'vue-router'
import CompareView from '@/views/CompareView.vue'

const routes = [
  { path: '/', name: 'compare', component: CompareView, meta: { title: 'Compare your commute' } },
  {
    path: '/impact',
    name: 'impact',
    component: () => import('@/views/ImpactView.vue'),
    meta: { title: 'Community impact' }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Transport emissions by country' }
  },
  {
    // Reached from "How we calculate this" rather than the main nav (E2.4).
    path: '/learn',
    name: 'learn',
    component: () => import('@/views/LearnView.vue'),
    meta: { title: 'How we calculate this' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · CO2 Compare` : 'CO2 Compare'
})

export default router
