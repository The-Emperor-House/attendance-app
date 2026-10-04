<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">คำขอลา</h2>
        <select v-model="statusFilter" class="rounded-lg border px-2 py-1 text-xs" @change="loadLeaves">
          <option value="PENDING">รออนุมัติ</option>
          <option value="APPROVED">อนุมัติแล้ว</option>
          <option value="REJECTED">ไม่อนุมัติ</option>
          <option value="">ทั้งหมด</option>
        </select>
      </div>
      <div v-if="!leaves.length" class="text-sm text-gray-500">ไม่มีคำขอลา</div>
      <ul v-else class="space-y-2">
        <li v-for="leave in leaves" :key="leave.id" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-900">
              {{ leave.employee.name }} <span class="text-xs text-gray-400">({{ leave.employee.department?.name || 'ไม่ระบุแผนก' }})</span>
            </span>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusClass(leave.status)">
              {{ statusLabel(leave.status) }}
            </span>
          </div>
          <p class="text-xs text-gray-500">
            {{ typeLabel(leave.type) }} · {{ formatDate(leave.startDate) }} – {{ formatDate(leave.endDate) }}
          </p>
          <p v-if="leave.reason" class="mt-1 text-gray-600">{{ leave.reason }}</p>
          <div v-if="leave.status === 'PENDING'" class="mt-2 flex gap-2">
            <button class="rounded-lg bg-brand-700 px-3 py-1 text-white" @click="decide(leave.id, 'APPROVED')">อนุมัติ</button>
            <button class="rounded-lg bg-red-600 px-3 py-1 text-white" @click="decide(leave.id, 'REJECTED')">ไม่อนุมัติ</button>
          </div>
          <p v-else-if="leave.approverNote" class="mt-1 text-xs text-gray-500">หมายเหตุ: {{ leave.approverNote }}</p>
        </li>
      </ul>
    </section>

    <!-- Leave setup is admin-only (the API rejects supervisors); supervisors only approve. -->
    <template v-if="canManage">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">หมวดหมู่การลา</h2>
      <form class="mb-3 flex gap-2" @submit.prevent="addCategory">
        <input v-model="newCategoryName" placeholder="เช่น ลาบวช, ลาคลอด" class="flex-1 rounded-lg border px-3 py-2 text-sm" required />
        <button class="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">เพิ่ม</button>
      </form>
      <ul class="space-y-1">
        <li v-for="c in allCategories" :key="c.code" class="flex items-center justify-between rounded-lg border p-2 text-sm">
          <span :class="{ 'text-gray-400 line-through': !c.active }">{{ c.name }}</span>
          <button
            class="rounded-lg border px-2 py-1 text-xs"
            :class="c.active ? 'text-red-600' : 'text-brand-700'"
            @click="toggleCategory(c)"
          >
            {{ c.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน' }}
          </button>
        </li>
      </ul>
      <p class="mt-2 text-xs text-gray-400">ปิดใช้งานแทนการลบ เพื่อไม่ให้ประวัติการลาเดิมเสียหาย</p>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">โควตาวันลามาตรฐาน (ต่อปี)</h2>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div v-for="d in defaults" :key="d.type">
          <label class="mb-1 block text-xs text-gray-500">{{ d.name || typeLabel(d.type) }}</label>
          <input
            v-model.number="d.annualDays"
            type="number"
            min="0"
            class="w-full rounded-lg border px-2 py-1.5 text-sm"
            @change="saveDefault(d)"
          />
        </div>
      </div>
      <p class="mt-2 text-xs text-gray-400">ใช้เป็นค่าเริ่มต้นของพนักงานทุกคน ปรับรายบุคคลได้ด้านล่าง</p>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">ปรับโควตารายบุคคล</h2>
      <select v-model="selectedEmployeeId" class="mb-3 w-full rounded-lg border px-3 py-2 text-sm" @change="loadEmployeeQuota">
        <option :value="null">เลือกพนักงาน...</option>
        <option v-for="emp in props.employees" :key="emp.id" :value="emp.id">{{ emp.name }} ({{ emp.employeeCode }})</option>
      </select>
      <div v-if="selectedEmployeeId && employeeQuota.length" class="space-y-2">
        <div v-for="q in employeeQuota" :key="q.type" class="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
          <span>{{ q.name || typeLabel(q.type) }}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">ใช้ไป {{ q.used }} วัน</span>
            <input
              v-model.number="q.quota"
              type="number"
              min="0"
              class="w-16 rounded border px-2 py-1 text-sm"
              @change="saveEmployeeQuota(q)"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">ปฏิทินวันหยุด</h2>
      <form class="mb-3 grid grid-cols-3 gap-2" @submit.prevent="addHoliday">
        <input v-model="newHoliday.date" type="date" class="col-span-1 rounded-lg border px-2 py-2 text-sm" required />
        <input v-model="newHoliday.name" placeholder="ชื่อวันหยุด" class="col-span-1 rounded-lg border px-2 py-2 text-sm" required />
        <button class="col-span-1 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">เพิ่ม</button>
      </form>
      <div v-if="!holidays.length" class="text-sm text-gray-500">ยังไม่มีวันหยุด</div>
      <ul v-else class="space-y-1">
        <li v-for="h in holidays" :key="h.id" class="flex items-center justify-between rounded-lg border p-2 text-sm">
          <span>{{ formatDate(h.date) }} — {{ h.name }}</span>
          <button class="text-xs text-red-600" @click="removeHoliday(h)">ลบ</button>
        </li>
      </ul>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ employees: any[]; canManage: boolean }>()

const { request } = useApi()
const { run, confirm } = useFeedback()

const leaves = ref<any[]>([])
const statusFilter = ref('PENDING')

const holidays = ref<any[]>([])
const newHoliday = reactive({ date: '', name: '' })

const defaults = ref<{ type: string; name?: string; annualDays: number }[]>([])
const selectedEmployeeId = ref<number | null>(null)
const employeeQuota = ref<{ type: string; name?: string; quota: number; used: number; remaining: number }[]>([])
const currentYear = new Date().getFullYear()

const allCategories = ref<{ code: string; name: string; active: boolean }[]>([])
const categoryMap = computed(() => Object.fromEntries(allCategories.value.map((c) => [c.code, c.name])))
const newCategoryName = ref('')

function typeLabel(type: string) {
  return categoryMap.value[type] || type
}
function statusLabel(status: string) {
  return { PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ' }[status] || status
}
function statusClass(status: string) {
  return (
    {
      PENDING: 'bg-orange-100 text-orange-700',
      APPROVED: 'bg-brand-100 text-brand-700',
      REJECTED: 'bg-red-100 text-red-700',
    }[status] || 'bg-gray-100 text-gray-700'
  )
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function loadLeaves() {
  const query = statusFilter.value ? `?status=${statusFilter.value}` : ''
  leaves.value = await request(`/api/leaves${query}`)
}

async function decide(id: number, decision: 'APPROVED' | 'REJECTED') {
  await run(
    async (step) => {
      await request(`/api/leaves/${id}/decide`, { method: 'POST', body: { decision } })
      step('กำลังโหลดรายการใหม่...')
      await loadLeaves()
    },
    {
      loading: decision === 'APPROVED' ? 'กำลังอนุมัติ...' : 'กำลังบันทึกไม่อนุมัติ...',
      success: decision === 'APPROVED' ? 'อนุมัติคำขอลาแล้ว' : 'บันทึกไม่อนุมัติแล้ว',
    }
  )
}

async function loadHolidays() {
  holidays.value = await request('/api/holidays')
}

async function addHoliday() {
  await run(
    async () => {
      await request('/api/holidays', { method: 'POST', body: newHoliday })
      Object.assign(newHoliday, { date: '', name: '' })
      await loadHolidays()
    },
    { loading: 'กำลังเพิ่มวันหยุด...', success: 'เพิ่มวันหยุดแล้ว' }
  )
}

async function removeHoliday(h: any) {
  if (!(await confirm({ title: `ลบวันหยุด "${h.name}"?`, confirmText: 'ลบ', danger: true }))) return
  await run(
    async () => {
      await request(`/api/holidays/${h.id}`, { method: 'DELETE' })
      await loadHolidays()
    },
    { loading: 'กำลังลบวันหยุด...', success: 'ลบวันหยุดแล้ว' }
  )
}

async function loadDefaults() {
  defaults.value = await request('/api/leave-quota/defaults')
}

async function saveDefault(d: { type: string; name?: string; annualDays: number }) {
  await run(() => request('/api/leave-quota/defaults', { method: 'PUT', body: { type: d.type, annualDays: d.annualDays } }), {
    loading: 'กำลังบันทึกโควตามาตรฐาน...',
    success: `บันทึกโควตา${d.name || typeLabel(d.type)}แล้ว`,
  })
}

async function loadEmployeeQuota() {
  if (!selectedEmployeeId.value) {
    employeeQuota.value = []
    return
  }
  const res = await request<{ summary: any[] }>(`/api/leave-quota/${selectedEmployeeId.value}`)
  employeeQuota.value = res.summary
}

async function saveEmployeeQuota(q: { type: string; quota: number }) {
  if (!selectedEmployeeId.value) return
  const employeeId = selectedEmployeeId.value
  await run(
    () =>
      request(`/api/leave-quota/${employeeId}`, {
        method: 'PUT',
        body: { type: q.type, year: currentYear, days: q.quota },
      }),
    { loading: 'กำลังบันทึกโควตารายบุคคล...', success: `บันทึกโควตา${q.name || typeLabel(q.type)}แล้ว` }
  )
}

async function loadCategories() {
  allCategories.value = await request('/api/leave-categories?all=true')
}

async function addCategory() {
  await run(
    async () => {
      await request('/api/leave-categories', { method: 'POST', body: { name: newCategoryName.value } })
      newCategoryName.value = ''
      await Promise.all([loadCategories(), loadDefaults()])
    },
    { loading: 'กำลังเพิ่มหมวดการลา...', success: 'เพิ่มหมวดการลาแล้ว' }
  )
}

async function toggleCategory(c: { code: string; name: string; active: boolean }) {
  if (
    c.active &&
    !(await confirm({
      title: `ปิดใช้งานหมวด "${c.name}"?`,
      message: 'พนักงานจะยื่นลาหมวดนี้ไม่ได้ แต่ประวัติเดิมยังอยู่',
      confirmText: 'ปิดใช้งาน',
      danger: true,
    }))
  )
    return
  await run(
    async () => {
      await request(`/api/leave-categories/${encodeURIComponent(c.code)}`, {
        method: 'PUT',
        body: { active: !c.active },
      })
      await Promise.all([loadCategories(), loadDefaults()])
    },
    { success: c.active ? 'ปิดใช้งานหมวดการลาแล้ว' : 'เปิดใช้งานหมวดการลาแล้ว' }
  )
}

onMounted(() => {
  loadLeaves()
  loadHolidays()
  loadDefaults()
  loadCategories()
})
</script>
