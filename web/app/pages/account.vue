<template>
  <div class="space-y-5">
    <h1 class="text-xl font-bold text-gray-900">บัญชีของฉัน</h1>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <p class="text-sm text-gray-500">ชื่อ</p>
      <p class="mb-2 font-medium text-gray-900">{{ auth.user?.name }}</p>
      <p class="text-sm text-gray-500">รหัสพนักงาน</p>
      <p class="mb-2 font-medium text-gray-900">{{ auth.user?.employeeCode }}</p>
      <p class="text-sm text-gray-500">บทบาท</p>
      <p class="font-medium text-gray-900">{{ auth.user?.role }}</p>
    </div>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
      <form class="space-y-2" @submit.prevent="submit">
        <input
          v-model="form.currentPassword"
          type="password"
          placeholder="รหัสผ่านปัจจุบัน"
          class="w-full rounded-lg border px-3 py-2 text-sm"
          required
        />
        <input
          v-model="form.newPassword"
          type="password"
          placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
          class="w-full rounded-lg border px-3 py-2 text-sm"
          required
          minlength="4"
        />
        <input
          v-model="form.confirmPassword"
          type="password"
          placeholder="ยืนยันรหัสผ่านใหม่"
          class="w-full rounded-lg border px-3 py-2 text-sm"
          required
          minlength="4"
        />
        <button class="w-full rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">เปลี่ยนรหัสผ่าน</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const auth = useAuthStore()
const { run, showError } = useFeedback()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

async function submit() {
  if (form.newPassword !== form.confirmPassword) {
    showError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน')
    return
  }

  await run(
    async () => {
      await request('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      })
      Object.assign(form, { currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    { loading: 'กำลังเปลี่ยนรหัสผ่าน...', success: 'เปลี่ยนรหัสผ่านสำเร็จ' }
  )
}
</script>
