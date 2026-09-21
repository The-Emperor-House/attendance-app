<template>
  <div class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center" @click.self="$emit('close')">
    <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
      <div class="mb-3 flex items-start justify-between">
        <div>
          <h2 class="font-semibold text-gray-900">{{ employee.name }}</h2>
          <p class="text-xs text-gray-500">
            {{ employee.employeeCode }} · {{ employee.department?.name || 'ไม่ระบุแผนก' }}
          </p>
        </div>
        <button class="text-gray-400" @click="$emit('close')">✕</button>
      </div>

      <div v-if="loading" class="py-6 text-center text-sm text-gray-500">กำลังโหลด...</div>
      <div v-else-if="!records.length" class="py-6 text-center text-sm text-gray-500">ยังไม่มีประวัติเช็คอิน</div>
      <ul v-else class="space-y-2">
        <li v-for="record in records" :key="record.id" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-900">{{ formatDate(record.date) }}</span>
            <span v-if="record.editedByHr" class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">แก้ไขแล้ว</span>
          </div>
          <p class="text-xs text-gray-500">{{ record.site.name }}</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p class="text-gray-500">เช็คอิน</p>
              <p>
                {{ record.checkInAt ? formatTime(record.checkInAt) : '-' }}
                <span v-if="record.checkInStatus" class="text-xs" :class="record.checkInStatus === 'NORMAL' ? 'text-brand-700' : 'text-orange-600'">
                  ({{ record.checkInStatus === 'NORMAL' ? 'ปกติ' : 'นอกพื้นที่' }})
                </span>
                <span v-if="record.checkInLate" class="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">สาย</span>
              </p>
            </div>
            <div>
              <p class="text-gray-500">เช็คเอาต์</p>
              <p>{{ record.checkOutAt ? formatTime(record.checkOutAt) : '-' }}</p>
            </div>
          </div>
          <p v-if="record.note" class="mt-1 text-xs text-gray-600">หมายเหตุ: {{ record.note }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ employee: any }>()
defineEmits<{ close: [] }>()

const { request } = useApi()
const records = ref<any[]>([])
const loading = ref(true)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  try {
    records.value = await request(`/api/attendance?employeeId=${props.employee.id}`)
  } finally {
    loading.value = false
  }
})
</script>
