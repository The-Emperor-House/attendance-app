// Opens an authenticated Excel export link. A plain <a href> can't carry an
// Authorization header, so instead of embedding the long-lived session JWT in the
// URL (logged by proxies, kept in browser history), we mint a fresh export-scoped
// token that expires in minutes and use that instead.
export function useExportDownload() {
  const { request } = useApi()
  const config = useRuntimeConfig()

  async function download(path: string, params: Record<string, string> = {}) {
    const { token } = await request<{ token: string }>('/api/auth/export-token')
    const query = new URLSearchParams({ ...params, token })
    window.open(`${config.public.apiBase}${path}?${query.toString()}`, '_blank')
  }

  return { download }
}
