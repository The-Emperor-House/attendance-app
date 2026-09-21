<template>
  <div class="flex min-h-[80vh] flex-col justify-center">
    <h1 class="mb-6 text-center text-2xl font-bold text-gray-900">เข้าสู่ระบบ</h1>
    <form class="space-y-4 rounded-xl border bg-white p-6 shadow-sm" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">รหัสพนักงาน</label>
        <input
          v-model="employeeCode"
          type="text"
          autocomplete="username"
          required
          class="w-full rounded-lg border px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">รหัสผ่าน</label>
        <input
          v-model="password"
          type="password"
          required
          class="w-full rounded-lg border px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-lg bg-brand-700 py-2 font-semibold text-white disabled:opacity-50"
      >
        {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
const employeeCode = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { request } = useApi()
const auth = useAuthStore()
const router = useRouter()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const res = await request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: { employeeCode: employeeCode.value, password: password.value },
    })
    auth.setSession(res.token, res.user)
    router.push('/')
  } catch (e: any) {
    error.value = e?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>
