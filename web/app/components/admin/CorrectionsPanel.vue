<template>
  <section class="rounded-xl border bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-semibold text-gray-900">คำขอแก้ไขเวลา</h2>
      <select v-model="statusFilter" class="rounded-lg border px-2 py-1 text-xs" @change="load">
        <option value="PENDING">รออนุมัติ</option>
        <option value="APPROVED">อนุมัติแล้ว</option>
        <option value="REJECTED">ไม่อนุมัติ</option>
        <option value="">ทั้งหมด</option>
      </select>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด...</div>
    <div v-else-if="!corrections.length" class="text-sm text-gray-500">ไม่มีคำขอ</div>
    <ul v-else class="space-y-2">
      <li v-for="c in corrections" :key="c.id" class="rounded-lg border p-3 text-sm">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-gray-900">
            {{ c.employee.name }} <span class="text-xs text-gray-400">({{ c.employee.department?.name || 'ไม่ระบุแผนก' }})</span>
          </span>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="statusClass(c.status)">
            {{ statusLabel(c.status) }}
          </span>
        </div>
        <p class="text-xs text-gray-500">
          {{ c.type === 'ADD_VISIT' ? 'ลืมเช็คอิน (เพิ่มรอบใหม่)' : 'แก้ไขเวลารอบที่มีอยู่' }} · {{ c.site.name }} · {{ formatDate(c.date) }}
        </p>

        <div class="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 text-xs">
          <div v-if="c.type === 'FIX_VISIT' && c.attendance">
            <p class="text-gray-500">ที่บันทึกไว้</p>
            <p>
              {{ c.attendance.checkInAt ? formatDateTime(c.attendance.checkInAt) : '-' }} –
              {{ c.attendance.checkOutAt ? formatDateTime(c.attendance.checkOutAt) : 'ไม่ได้เช็คเอาต์' }}
            </p>
          </div>
          <div>
            <p class="text-gray-500">ขอเป็น</p>
            <p class="font-medium text-gray-900">
              {{ c.checkInAt ? formatDateTime(c.checkInAt) : 'คงเดิม' }} – {{ c.checkOutAt ? formatDateTime(c.checkOutAt) : 'คงเดิม' }}
            </p>
          </div>
        </div>

        <p class="mt-2 text-gray-600">เหตุผล: {{ c.reason }}</p>

        <div v-if="c.status === 'PENDING'" class="mt-2 flex gap-2">
          <button class="rounded-lg bg-brand-700 px-3 py-1 text-white" @click="decide(c, 'APPROVED')">อนุมัติ</button>
          <button class="rounded-lg bg-red-600 px-3 py-1 text-white" @click="decide(c, 'REJECTED')">ไม่อนุมัติ</button>
        </div>
        <p v-else class="mt-1 text-xs text-gray-500">
          โดย {{ c.reviewedBy?.name || '-' }}<span v-if="c.reviewerNote"> · {{ c.reviewerNote }}</span>
        </p>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { request } = useApi()
const { run, confirm } = useFeedback()

const corrections = ref<any[]>([])
const statusFilter = ref('PENDING')
const loading = ref(true)

function statusLabel(status: string) {
  return { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' }[status] || status
}
function statusClass(status: string) {
  return (
    { PENDING: 'bg-orange-100 text-orange-700', APPROVED: 'bg-brand-100 text-brand-700', REJECTED: 'bg-red-100 text-red-700' }[
      status
    ] || 'bg-gray-100 text-gray-700'
  )
}
// Dates are calendar days stored as UTC midnight; times are shown in Bangkok time.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

async function load() {
  loading.value = true
  try {
    const query = statusFilter.value ? `?status=${statusFilter.value}` : ''
    corrections.value = await request(`/api/corrections${query}`)
  } finally {
    loading.value = false
  }
}

async function decide(c: any, decision: 'APPROVED' | 'REJECTED') {
  const approving = decision === 'APPROVED'
  const ok = await confirm({
    title: approving ? `อนุมัติคำขอของ ${c.employee.name}?` : `ไม่อนุมัติคำขอของ ${c.employee.name}?`,
    message: approving ? 'เวลาในบันทึกการเข้างานจะถูกแก้ตามคำขอนี้ทันที' : undefined,
    confirmText: approving ? 'อนุมัติ' : 'ไม่อนุมัติ',
    danger: !approving,
  })
  if (!ok) return
  await run(
    async (step) => {
      await request(`/api/corrections/${c.id}/decide`, { method: 'POST', body: { decision } })
      step('กำลังโหลดรายการใหม่...')
      await load()
    },
    {
      loading: approving ? 'กำลังอนุมัติและแก้ไขเวลา...' : 'กำลังบันทึกไม่อนุมัติ...',
      success: approving ? 'อนุมัติแล้ว เวลาถูกแก้ไขเรียบร้อย' : 'บันทึกไม่อนุมัติแล้ว',
    }
  )
}

onMounted(load)
</script>
