<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold text-gray-900">ประวัติการเช็คอิน</h1>
    <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด...</div>
    <div v-else-if="!records.length" class="text-sm text-gray-500">ยังไม่มีประวัติ</div>
    <ul v-else class="space-y-3">
      <li v-for="record in records" :key="record.id" class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ formatDate(record.date) }}</span>
          <span v-if="record.editedByHr" class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            แก้ไขโดย HR
          </span>
        </div>
        <p class="mt-1 text-sm text-gray-600">{{ record.site.name }}</p>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p class="text-gray-500">เช็คอิน</p>
            <p class="font-medium">{{ record.checkInAt ? formatTime(record.checkInAt) : '-' }}</p>
            <span v-if="record.checkInStatus" class="text-xs" :class="statusClass(record.checkInStatus)">
              {{ statusLabel(record.checkInStatus) }}
            </span>
            <span v-if="record.checkInLate" class="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
              สาย
            </span>
          </div>
          <div>
            <p class="text-gray-500">เช็คเอาต์</p>
            <p class="font-medium">{{ record.checkOutAt ? formatTime(record.checkOutAt) : '-' }}</p>
            <span v-if="record.checkOutStatus" class="text-xs" :class="statusClass(record.checkOutStatus)">
              {{ statusLabel(record.checkOutStatus) }}
            </span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const records = ref<any[]>([])
const loading = ref(true)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function statusLabel(status: string) {
  return { NORMAL: 'ปกติ', OUT_OF_RANGE: 'นอกพื้นที่', OFF_SITE: 'งานนอกสถานที่' }[status] || status
}
function statusClass(status: string) {
  if (status === 'NORMAL') return 'text-brand-700'
  if (status === 'OFF_SITE') return 'text-blue-700'
  return 'text-orange-600'
}

onMounted(async () => {
  try {
    records.value = await request('/api/attendance/me')
  } finally {
    loading.value = false
  }
})
</script>
