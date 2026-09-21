// Fetches JSON via XHR so we can report real download progress (%) for large
// responses (e.g. "load all months" of attendance records), which $fetch/ofetch
// cannot expose. Falls back to indeterminate progress when Content-Length is missing.
export function useProgressFetch() {
  function getJSON<T>(url: string, token: string | null, onProgress: (percent: number | null) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        } else {
          onProgress(null)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (e) {
            reject(e)
          }
        } else {
          reject(new Error(`Request failed: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send()
    })
  }

  return { getJSON }
}
