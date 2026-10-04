<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-bold text-gray-900">ประวัติการเช็คอิน</h1>
      <button class="shrink-0 rounded-lg border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700" @click="openForm(null)">
        + แจ้งลืมเช็คอิน
      </button>
    </div>

    <section v-if="corrections.length" class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-2 font-semibold text-gray-900">คำขอแก้ไขเวลา</h2>
      <ul class="space-y-2">
        <li v-for="c in corrections" :key="c.id" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">{{ c.type === 'ADD_VISIT' ? 'เพิ่มรอบที่ลืมเช็คอิน' : 'แก้ไขเวลา' }}</span>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="correctionStatusClass(c.status)">
              {{ correctionStatusLabel(c.status) }}
            </span>
          </div>
          <p class="text-xs text-gray-500">
            {{ c.site.name }} · {{ formatDate(c.date) }} ·
            เข้า {{ c.checkInAt ? formatTime(c.checkInAt) : 'คงเดิม' }} – ออก {{ c.checkOutAt ? formatTime(c.checkOutAt) : 'คงเดิม' }}
          </p>
          <p class="mt-1 text-gray-600">{{ c.reason }}</p>
          <p v-if="c.reviewerNote" class="mt-1 text-xs text-gray-500">หมายเหตุผู้อนุมัติ: {{ c.reviewerNote }}</p>
          <button v-if="c.status === 'PENDING'" class="mt-2 text-xs text-red-600" @click="cancelCorrection(c.id)">ยกเลิกคำขอ</button>
        </li>
      </ul>
    </section>

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
        <p class="mt-1 text-sm text-gray-600">
          {{ record.site.name }}<span v-if="visitsPerDay[record.date] > 1" class="text-gray-400"> · ครั้งที่ {{ record.visitNo }}</span>
        </p>
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
        <p v-if="pendingVisitIds.has(record.id)" class="mt-2 text-xs text-orange-700">มีคำขอแก้ไขเวลารออนุมัติ</p>
        <button v-else class="mt-2 text-xs text-brand-700 underline" @click="openForm(record)">ขอแก้ไขเวลา</button>
      </li>
    </ul>

    <CorrectionForm v-if="formOpen" :visit="formVisit" :sites="sites" @close="formOpen = false" @done="onSubmitted" />
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const { run, confirm } = useFeedback()
const route = useRoute()

const records = ref<any[]>([])
const corrections = ref<any[]>([])
const sites = ref<any[]>([])
const loading = ref(true)

const formOpen = ref(false)
const formVisit = ref<any | null>(null)

// Number of visits per date, so "visit N" is only shown on days with several.
const visitsPerDay = computed(() => {
  const counts: Record<string, number> = {}
  for (const r of records.value) counts[r.date] = (counts[r.date] ?? 0) + 1
  return counts
})

const pendingVisitIds = computed(
  () => new Set(corrections.value.filter((c) => c.status === 'PENDING' && c.attendanceId).map((c) => c.attendanceId))
)

// Dates are calendar days stored as UTC midnight; times are shown in Bangkok time.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function statusLabel(status: string) {
  return { NORMAL: 'ปกติ', OUT_OF_RANGE: 'นอกพื้นที่', OFF_SITE: 'งานนอกสถานที่' }[status] || status
}
function statusClass(status: string) {
  if (status === 'NORMAL') return 'text-brand-700'
  if (status === 'OFF_SITE') return 'text-blue-700'
  return 'text-orange-600'
}
function correctionStatusLabel(status: string) {
  return { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' }[status] || status
}
function correctionStatusClass(status: string) {
  return (
    { PENDING: 'bg-orange-100 text-orange-700', APPROVED: 'bg-brand-100 text-brand-700', REJECTED: 'bg-red-100 text-red-700' }[
      status
    ] || 'bg-gray-100 text-gray-700'
  )
}

function openForm(visit: any | null) {
  formVisit.value = visit
  formOpen.value = true
}

async function load() {
  const [visits, mine] = await Promise.all([request<any[]>('/api/attendance/me'), request<any[]>('/api/corrections/me')])
  records.value = visits
  corrections.value = mine
}

async function onSubmitted() {
  formOpen.value = false
  await load()
}

async function cancelCorrection(id: number) {
  if (!(await confirm({ title: 'ยกเลิกคำขอแก้ไขเวลานี้?', confirmText: 'ยกเลิกคำขอ', danger: true }))) return
  await run(
    async () => {
      await request(`/api/corrections/${id}`, { method: 'DELETE' })
      await load()
    },
    { loading: 'กำลังยกเลิกคำขอ...', success: 'ยกเลิกคำขอแล้ว' }
  )
}

onMounted(async () => {
  try {
    await load()
    sites.value = await request('/api/sites?mine=1')
  } finally {
    loading.value = false
  }
  // Linked from the check-in page's "forgot to check out?" prompt.
  const fixId = Number(route.query.fix)
  const visit = fixId && records.value.find((r) => r.id === fixId)
  if (visit && !pendingVisitIds.value.has(visit.id)) openForm(visit)
})
</script>
