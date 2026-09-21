<template>
  <div class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" @click.self="$emit('close')">
    <div class="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
      <div class="mb-3 flex items-start justify-between">
        <h2 class="font-semibold text-gray-900">ให้ {{ employee.name }} พ้นสภาพพนักงาน</h2>
        <button class="text-gray-400" @click="$emit('close')">✕</button>
      </div>

      <form class="space-y-2" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-xs text-gray-500">วันที่มีผล</label>
          <input v-model="form.effectiveDate" type="date" required class="w-full rounded-lg border px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">ประเภท</label>
          <select v-model="form.resignationType" class="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="RESIGNED">ลาออกเอง</option>
            <option value="TERMINATED">เลิกจ้าง</option>
            <option value="RETIRED">เกษียณอายุ</option>
            <option value="OTHER">อื่นๆ</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">เหตุผล (ไม่บังคับ)</label>
          <textarea v-model="form.resignationReason" rows="2" class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white" :disabled="submitting">
            {{ submitting ? 'กำลังบันทึก...' : 'ยืนยันให้พ้นสภาพ' }}
          </button>
          <button type="button" class="rounded-lg border px-4 py-2 text-sm" @click="$emit('close')">ยกเลิก</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ employee: any }>()
const emit = defineEmits<{ close: []; done: [] }>()

const { request } = useApi()
const error = ref('')
const submitting = ref(false)

const form = reactive({
  effectiveDate: new Date().toISOString().slice(0, 10),
  resignationType: 'RESIGNED',
  resignationReason: '',
})

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await request(`/api/employees/${props.employee.id}/resign`, {
      method: 'POST',
      body: { ...form, resignationReason: form.resignationReason || undefined },
    })
    emit('done')
  } catch (e: any) {
    error.value = e?.data?.error || 'บันทึกไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}
</script>
