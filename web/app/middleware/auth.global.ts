export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client && !auth.token) {
    auth.hydrate()
  }

  const publicPages = ['/login']
  if (!auth.isAuthenticated && !publicPages.includes(to.path)) {
    return navigateTo('/login')
  }
  if (auth.isAuthenticated && to.path === '/login') {
    return navigateTo('/')
  }
  // The management page is for admins and supervisors only (the API enforces this too).
  if (to.path.startsWith('/admin') && auth.user?.role !== 'ADMIN' && auth.user?.role !== 'SUPERVISOR') {
    return navigateTo('/')
  }
})
