// One shared dialog (rendered by <FeedbackModal> in app.vue) for every save action:
// a blocking loading state that names the current step, then a success or error
// result, plus a confirm prompt for destructive actions. Wrap saves in run().

type Phase = 'idle' | 'loading' | 'success' | 'error' | 'confirm'

interface FeedbackState {
  phase: Phase
  title: string
  message: string
  // Set once a request has been loading for a while, so the dialog can say it is still working.
  slow: boolean
  confirmText: string
  danger: boolean
}

interface RunOptions {
  loading?: string
  success?: string | false
}

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
}

const SLOW_AFTER_MS = 8000
const SUCCESS_AUTO_CLOSE_MS = 1500

const idle = (): FeedbackState => ({ phase: 'idle', title: '', message: '', slow: false, confirmText: '', danger: false })

// Module-level: callbacks can't live in useState, and there is only ever one dialog.
let timers: ReturnType<typeof setTimeout>[] = []
let confirmResolver: ((ok: boolean) => void) | null = null

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

// Turns an API/network error into something a user can act on. The API returns either
// { error: "message" } or a zod flatten() object { formErrors, fieldErrors }.
export function apiErrorMessage(e: any, fallback = 'บันทึกไม่สำเร็จ กรุณาลองใหม่'): string {
  const err = e?.data?.error
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const fields = Object.entries(err.fieldErrors ?? {}).map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
    const msgs = [...(err.formErrors ?? []), ...fields]
    if (msgs.length) return `ข้อมูลไม่ถูกต้อง — ${msgs.join(' · ')}`
  }
  if (e?.name === 'TimeoutError' || e?.cause?.name === 'TimeoutError' || /timeout/i.test(e?.message ?? '')) {
    return 'เซิร์ฟเวอร์ตอบช้าเกินไป (หมดเวลา) กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
  }
  if (e?.response?.status === 403) return 'คุณไม่มีสิทธิ์ทำรายการนี้'
  if (e?.name === 'FetchError' && !e?.response) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
  return fallback
}

export function useFeedback() {
  const state = useState<FeedbackState>('feedback', idle)

  function close() {
    clearTimers()
    state.value = idle()
  }

  function showError(message: string) {
    clearTimers()
    state.value = { ...idle(), phase: 'error', title: 'ไม่สำเร็จ', message }
  }

  function showSuccess(message: string) {
    clearTimers()
    state.value = { ...idle(), phase: 'success', title: 'สำเร็จ', message }
    timers.push(setTimeout(() => state.value.phase === 'success' && close(), SUCCESS_AUTO_CLOSE_MS))
  }

  // Runs `action` behind the loading dialog. `step(msg)` updates the loading text for
  // multi-step saves. Resolves true on success, false on failure (the error is shown).
  async function run(
    action: (step: (message: string) => void) => Promise<unknown>,
    options: RunOptions = {}
  ): Promise<boolean> {
    if (state.value.phase === 'loading') return false // ignore double submits

    clearTimers()
    state.value = { ...idle(), phase: 'loading', message: options.loading ?? 'กำลังบันทึก...' }
    timers.push(setTimeout(() => state.value.phase === 'loading' && (state.value.slow = true), SLOW_AFTER_MS))

    try {
      await action((message) => {
        state.value.message = message
      })
    } catch (e: any) {
      // useApi already logged out and redirected to /login on 401.
      if (e?.response?.status === 401) close()
      else showError(apiErrorMessage(e))
      return false
    }

    if (options.success === false) close()
    else showSuccess(options.success ?? 'บันทึกเรียบร้อยแล้ว')
    return true
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    confirmResolver?.(false)
    clearTimers()
    state.value = {
      ...idle(),
      phase: 'confirm',
      title: options.title,
      message: options.message ?? '',
      confirmText: options.confirmText ?? 'ยืนยัน',
      danger: options.danger ?? false,
    }
    return new Promise((resolve) => {
      confirmResolver = resolve
    })
  }

  function answerConfirm(ok: boolean) {
    const resolve = confirmResolver
    confirmResolver = null
    close()
    resolve?.(ok)
  }

  return { state, run, confirm, answerConfirm, showError, showSuccess, close }
}
