<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">รายการเช็คอิน / แก้ไขโดย HR</h2>
        <span class="text-xs text-gray-400">{{ filteredRecords.length }} รายการ</span>
      </div>

      <div class="mb-2 flex flex-wrap items-center gap-2">
        <select v-model="mode" class="rounded-lg border px-2 py-1 text-xs" @change="load">
          <option value="month">เลือกเดือน</option>
          <option value="all">โหลดทั้งหมด</option>
        </select>
        <template v-if="mode === 'month'">
          <select v-model.number="month" class="rounded-lg border px-2 py-1 text-xs" @change="load">
            <option v-for="m in 12" :key="m" :value="m">เดือน {{ m }}</option>
          </select>
          <select v-model.number="year" class="rounded-lg border px-2 py-1 text-xs" @change="load">
            <option v-for="y in years" :key="y" :value="y">ปี {{ y }}</option>
          </select>
        </template>
        <select v-model="statusFilter" class="rounded-lg border px-2 py-1 text-xs" @change="load">
          <option value="">ทุกสถานะ</option>
          <option value="OUT_OF_RANGE">นอกพื้นที่</option>
          <option value="OFF_SITE">งานนอกสถานที่</option>
        </select>
      </div>
      <input
        v-model="search"
        placeholder="ค้นหาชื่อพนักงาน..."
        class="mb-2 w-full rounded-lg border px-3 py-1.5 text-xs"
        @input="page = 1"
      />
      <p v-if="mode === 'all'" class="mb-2 text-xs text-orange-600">โหลดข้อมูลทั้งหมดอาจใช้เวลานานถ้ามีประวัติเยอะ</p>

      <div v-if="loading" class="mb-3">
        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full bg-brand-600 transition-all"
            :class="{ 'animate-pulse': progress === null }"
            :style="{ width: `${progress ?? 60}%` }"
          />
        </div>
        <p class="mt-1 text-xs text-gray-500">{{ progress !== null ? `กำลังโหลด ${progress}%` : 'กำลังโหลด...' }}</p>
      </div>

      <div v-else-if="!filteredRecords.length" class="py-6 text-center text-sm text-gray-500">ไม่มีรายการ</div>
      <ul v-else class="divide-y">
        <li v-for="record in pageRecords" :key="record.id">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm"
            @click="toggle(record.id)"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-gray-900">{{ record.employee.name }}</p>
              <p class="text-xs text-gray-500">{{ formatDate(record.date) }} · {{ record.site.name }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="text-xs text-gray-600">
                {{ record.checkInAt ? formatTime(record.checkInAt) : '-' }}–{{ record.checkOutAt ? formatTime(record.checkOutAt) : '-' }}
              </span>
              <span v-if="record.checkInLate" class="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">สาย</span>
              <span v-if="record.checkInStatus === 'OUT_OF_RANGE'" class="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">นอก</span>
              <span v-if="record.checkInStatus === 'OFF_SITE'" class="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">นอกที่</span>
              <span v-if="record.editedByHr" class="rounded-full bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">แก้ไข</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="h-4 w-4 shrink-0 text-gray-400 transition"
                :class="{ 'rotate-180': expandedId === record.id }"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <div v-if="expandedId === record.id" class="pb-3">
            <template v-if="editingId === record.id">
              <div class="space-y-2 rounded-lg bg-gray-50 p-3">
                <div>
                  <label class="block text-xs text-gray-500">เวลาเช็คอิน</label>
                  <input v-model="editForm.checkInAt" type="datetime-local" class="w-full rounded border px-2 py-1 text-sm" />
                  <div class="mt-1 flex gap-2">
                    <select v-model="editForm.checkInStatus" class="flex-1 rounded border px-2 py-1 text-sm">
                      <option value="NORMAL">ปกติ</option>
                      <option value="OUT_OF_RANGE">นอกพื้นที่</option>
                      <option value="OFF_SITE">งานนอกสถานที่</option>
                    </select>
                    <label class="flex items-center gap-1 text-xs">
                      <input v-model="editForm.checkInLate" type="checkbox" /> สาย
                    </label>
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-500">เวลาเช็คเอาต์</label>
                  <input v-model="editForm.checkOutAt" type="datetime-local" class="w-full rounded border px-2 py-1 text-sm" />
                  <select v-model="editForm.checkOutStatus" class="mt-1 w-full rounded border px-2 py-1 text-sm">
                    <option value="NORMAL">ปกติ</option>
                    <option value="OUT_OF_RANGE">นอกพื้นที่</option>
                    <option value="OFF_SITE">งานนอกสถานที่</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500">หมายเหตุ</label>
                  <textarea v-model="editForm.note" rows="2" class="w-full rounded border px-2 py-1 text-sm"></textarea>
                </div>
                <div class="flex gap-2">
                  <button class="rounded-lg bg-brand-700 px-3 py-1 text-sm text-white" @click="saveEdit(record.id)">บันทึก</button>
                  <button class="rounded-lg border px-3 py-1 text-sm" @click="editingId = null">ยกเลิก</button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                <div>
                  <p class="text-gray-500">เช็คอิน</p>
                  <p>{{ record.checkInAt ? formatTime(record.checkInAt) : '-' }} <span class="text-xs">({{ record.checkInStatus || '-' }})</span></p>
                </div>
                <div>
                  <p class="text-gray-500">เช็คเอาต์</p>
                  <p>{{ record.checkOutAt ? formatTime(record.checkOutAt) : '-' }} <span class="text-xs">({{ record.checkOutStatus || '-' }})</span></p>
                </div>
              </div>
              <p v-if="record.note" class="mt-2 text-sm text-gray-600">หมายเหตุ: {{ record.note }}</p>
              <button class="mt-2 rounded-lg border px-3 py-1 text-sm" @click="startEdit(record)">แก้ไข</button>
            </template>
          </div>
        </li>
      </ul>

      <div v-if="totalPages > 1" class="mt-3 flex items-center justify-center gap-3 text-sm">
        <button class="rounded-lg border px-3 py-1 disabled:opacity-40" :disabled="page <= 1" @click="page--">ก่อนหน้า</button>
        <span class="text-gray-500">หน้า {{ page }} / {{ totalPages }}</span>
        <button class="rounded-lg border px-3 py-1 disabled:opacity-40" :disabled="page >= totalPages" @click="page++">ถัดไป</button>
      </div>
    </section>

    <button type="button" class="block w-full text-center text-sm text-brand-700 underline" @click="downloadExport">
      ดาวน์โหลดรายงาน Excel
    </button>
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const { getJSON } = useProgressFetch()
const { download } = useExportDownload()
const config = useRuntimeConfig()
const auth = useAuthStore()

const now = new Date()
const mode = ref<'month' | 'all'>('month')
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
const statusFilter = ref('')
const search = ref('')

const records = ref<any[]>([])
const loading = ref(false)
const progress = ref<number | null>(null)

const expandedId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editForm = reactive({
  checkInAt: '',
  checkOutAt: '',
  checkInStatus: 'NORMAL',
  checkOutStatus: 'NORMAL',
  checkInLate: false,
  note: '',
})

const page = ref(1)
const pageSize = 15

const filteredRecords = computed(() => {
  if (!search.value.trim()) return records.value
  const q = search.value.trim().toLowerCase()
  return records.value.filter((r) => r.employee.name.toLowerCase().includes(q))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize)))
const pageRecords = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredRecords.value.slice(start, start + pageSize)
})

watch(filteredRecords, () => {
  if (page.value > totalPages.value) page.value = 1
})

function toggle(id: number) {
  expandedId.value = expandedId.value === id ? null : id
  if (expandedId.value !== id) editingId.value = null
}

function downloadExport() {
  download('/api/reports/export')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function monthRange() {
  const start = new Date(year.value, month.value - 1, 1)
  const end = new Date(year.value, month.value, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(start), to: fmt(end) }
}

async function load() {
  loading.value = true
  progress.value = null
  page.value = 1
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (mode.value === 'month') {
      const { from, to } = monthRange()
      params.set('from', from)
      params.set('to', to)
    }
    const url = `${config.public.apiBase}/api/attendance?${params.toString()}`
    records.value = await getJSON<any[]>(url, auth.token, (p) => (progress.value = p))
  } finally {
    loading.value = false
    progress.value = null
  }
}

function startEdit(record: any) {
  editingId.value = record.id
  editForm.checkInAt = toLocalInput(record.checkInAt)
  editForm.checkOutAt = toLocalInput(record.checkOutAt)
  editForm.checkInStatus = record.checkInStatus || 'NORMAL'
  editForm.checkOutStatus = record.checkOutStatus || 'NORMAL'
  editForm.checkInLate = !!record.checkInLate
  editForm.note = record.note || ''
}

async function saveEdit(id: number) {
  await request(`/api/attendance/${id}`, {
    method: 'PUT',
    body: {
      checkInAt: editForm.checkInAt ? new Date(editForm.checkInAt).toISOString() : null,
      checkOutAt: editForm.checkOutAt ? new Date(editForm.checkOutAt).toISOString() : null,
      checkInStatus: editForm.checkInStatus,
      checkOutStatus: editForm.checkOutStatus,
      checkInLate: editForm.checkInLate,
      note: editForm.note,
    },
  })
  editingId.value = null
  await load()
}

onMounted(load)
</script>
