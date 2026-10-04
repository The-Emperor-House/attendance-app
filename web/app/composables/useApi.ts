export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  // Captured here: navigateTo() after an await can run outside the Nuxt context.
  const router = useRouter()

  async function request<T>(path: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = { ...(options.headers || {}) }
    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }

    try {
      return await $fetch<T>(path, {
        baseURL: config.public.apiBase,
        // Without a timeout a stalled request leaves the loading dialog up forever.
        timeout: 30000,
        ...options,
        headers,
      })
    } catch (e: any) {
      // Expired token or deactivated account: drop the session and go back to login
      // instead of leaving every screen failing. Login itself returns 401 for a bad password.
      if (e?.response?.status === 401 && auth.token) {
        auth.logout()
        await router.push('/login')
      }
      throw e
    }
  }

  return { request }
}
