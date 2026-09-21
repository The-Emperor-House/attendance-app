export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  async function request<T>(path: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = { ...(options.headers || {}) }
    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }

    return await $fetch<T>(path, {
      baseURL: config.public.apiBase,
      ...options,
      headers,
    })
  }

  return { request }
}
