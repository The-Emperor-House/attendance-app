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
})
