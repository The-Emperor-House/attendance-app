<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">{{ editingId ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน' }}</h2>
      <form class="space-y-2" @submit.prevent="submitEmployee">
        <input v-model="form.employeeCode" placeholder="รหัสพนักงาน เช่น EMP002" class="w-full rounded-lg border px-3 py-2 text-sm" required />
        <input v-model="form.name" placeholder="ชื่อ-นามสกุล" class="w-full rounded-lg border px-3 py-2 text-sm" required />
        <input v-model="form.email" type="email" placeholder="อีเมล (ไม่บังคับ)" class="w-full rounded-lg border px-3 py-2 text-sm" />
        <input
          v-model="form.password"
          type="password"
          :placeholder="editingId ? 'เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่านเริ่มต้น'"
          class="w-full rounded-lg border px-3 py-2 text-sm"
          :required="!editingId"
          minlength="6"
        />
        <div class="grid grid-cols-2 gap-2">
          <select v-model="form.role" class="w-full rounded-lg border px-3 py-2 text-sm">
            <option value="EMPLOYEE">พนักงาน</option>
            <option value="SUPERVISOR">หัวหน้างาน</option>
            <option value="ADMIN">ผู้ดูแลระบบ</option>
          </select>
          <select v-model="form.departmentId" class="w-full rounded-lg border px-3 py-2 text-sm">
            <option :value="null">ไม่ระบุแผนก</option>
            <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-xs text-gray-500">หัวหน้างานที่อนุมัติให้คนนี้</label>
          <select v-model="form.supervisorId" class="w-full rounded-lg border px-3 py-2 text-sm">
            <option :value="null">ไม่ระบุหัวหน้างาน</option>
            <option v-for="sup in supervisorOptions" :key="sup.id" :value="sup.id">
              {{ sup.name }} ({{ roleLabel(sup.role) }})
            </option>
          </select>
        </div>

        <div>
          <p class="mb-1 text-xs text-gray-500">สถานที่ที่อนุญาตให้เช็คอิน</p>
          <label v-for="site in sites" :key="site.id" class="mr-3 inline-flex items-center gap-1 text-sm">
            <input v-model="form.siteIds" type="checkbox" :value="site.id" />
            {{ site.name }}
          </label>
          <p v-if="!sites.length" class="text-xs text-gray-400">ยังไม่มีสถานที่ — ไปเพิ่มที่แท็บ "สถานที่" ก่อน</p>
        </div>

        <div class="rounded-lg border border-dashed p-3">
          <label class="mb-2 flex items-center gap-2 text-xs font-medium text-gray-600">
            <input v-model="hasOwnShift" type="checkbox" />
            กำหนดรอบเวลาเข้างาน (ไม่ตั้งไว้ = ไม่ตรวจว่าสายหรือไม่)
          </label>
          <template v-if="hasOwnShift">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="mb-1 block text-xs text-gray-500">เวลาเข้างาน</label>
                <input v-model="form.shift.startTime" type="time" class="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-500">เวลาเลิกงาน</label>
                <input v-model="form.shift.endTime" type="time" class="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
            </div>
            <label class="mt-2 block text-xs text-gray-500">ผ่อนผันสาย (นาที)</label>
            <input v-model.number="form.shift.graceMinutes" type="number" min="0" class="w-full rounded-lg border px-3 py-2 text-sm" />
            <p class="mb-1 mt-2 text-xs text-gray-500">วันทำงาน</p>
            <div class="flex flex-wrap gap-2">
              <label v-for="day in weekdays" :key="day.value" class="inline-flex items-center gap-1 text-xs">
                <input v-model="form.shift.workDays" type="checkbox" :value="day.value" />
                {{ day.label }}
              </label>
            </div>
          </template>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">
            {{ editingId ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน' }}
          </button>
          <button v-if="editingId" type="button" class="rounded-lg border px-4 py-2 text-sm" @click="resetForm">ยกเลิก</button>
        </div>
      </form>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="font-semibold text-gray-900">พนักงานทั้งหมด ({{ total }})</h2>
      </div>
      <div class="mb-3 flex gap-2">
        <input v-model="search" placeholder="ค้นหาชื่อ/รหัสพนักงาน" class="flex-1 rounded-lg border px-3 py-2 text-sm" @input="debouncedSearch" />
        <select v-model="departmentFilter" class="rounded-lg border px-2 py-2 text-sm" @change="() => { page = 1; emit('search', { search, departmentId: departmentFilter }) }">
          <option value="">ทุกแผนก</option>
          <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
        </select>
      </div>

      <div v-if="!employees.length" class="text-sm text-gray-500">ไม่พบพนักงาน</div>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          v-for="emp in employees"
          :key="emp.id"
          type="button"
          class="rounded-lg border p-3 text-left text-sm transition hover:border-brand-600 hover:shadow-sm"
          @click="viewingEmployee = emp"
        >
          <div class="flex items-center justify-between">
            <p class="font-medium text-gray-900">{{ emp.name }}</p>
            <span v-if="!emp.active" class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
              พ้นสภาพ{{ emp.resignationType ? ` (${resignTypeLabel(emp.resignationType)})` : '' }}
            </span>
          </div>
          <p class="text-xs text-gray-400">{{ emp.employeeCode }}</p>
          <p class="mt-1 text-xs text-gray-500">
            {{ roleLabel(emp.role) }} · {{ emp.department?.name || 'ไม่ระบุแผนก' }}
          </p>
          <p class="text-xs text-gray-500">หัวหน้างาน: {{ emp.supervisor?.name || 'ไม่ระบุ' }}</p>
          <p class="text-xs text-gray-500">
            {{ emp.sites.map((s: any) => s.site.name).join(', ') || 'ยังไม่ผูกสถานที่' }}
          </p>
          <p v-if="emp.shift" class="text-xs text-gray-500">
            กะ {{ emp.shift.startTime }}–{{ emp.shift.endTime }} · {{ formatWorkDays(emp.shift.workDays) }}
          </p>
          <p v-if="!emp.active && emp.resignedAt" class="text-xs text-red-500">
            มีผล {{ formatDate(emp.resignedAt) }}<span v-if="emp.resignationReason"> · {{ emp.resignationReason }}</span>
          </p>
          <div class="mt-2 flex gap-2" @click.stop>
            <button type="button" class="rounded-lg border px-3 py-1 text-xs" @click="startEdit(emp)">แก้ไข</button>
            <button v-if="emp.active" type="button" class="rounded-lg border px-3 py-1 text-xs text-red-600" @click="resigningEmployee = emp">
              ให้พ้นสภาพ
            </button>
            <button v-else type="button" class="rounded-lg border px-3 py-1 text-xs text-brand-700" @click="reactivate(emp.id)">
              คืนสถานะ
            </button>
          </div>
        </button>
      </div>

      <div v-if="totalPages > 1" class="mt-3 flex items-center justify-center gap-3 text-sm">
        <button class="rounded-lg border px-3 py-1 disabled:opacity-40" :disabled="page <= 1" @click="changePage(page - 1)">ก่อนหน้า</button>
        <span class="text-gray-500">หน้า {{ page }} / {{ totalPages }}</span>
        <button class="rounded-lg border px-3 py-1 disabled:opacity-40" :disabled="page >= totalPages" @click="changePage(page + 1)">ถัดไป</button>
      </div>
    </section>

    <AdminEmployeeDetailModal v-if="viewingEmployee" :employee="viewingEmployee" @close="viewingEmployee = null" />
    <AdminResignModal
      v-if="resigningEmployee"
      :employee="resigningEmployee"
      @close="resigningEmployee = null"
      @done="onResignDone"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  employees: any[]
  allEmployees: any[]
  sites: any[]
  departments: any[]
  total: number
  page: number
  pageSize: number
}>()
const emit = defineEmits<{ reload: []; search: [{ search: string; departmentId: string | number }]; page: [number] }>()

const { request } = useApi()
const error = ref('')
const search = ref('')
const departmentFilter = ref<string | number>('')
const page = computed(() => props.page)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const supervisorOptions = computed(() =>
  props.allEmployees.filter((e) => (e.role === 'SUPERVISOR' || e.role === 'ADMIN') && e.id !== editingId.value)
)

const weekdays = [
  { value: 1, label: 'จ' },
  { value: 2, label: 'อ' },
  { value: 3, label: 'พ' },
  { value: 4, label: 'พฤ' },
  { value: 5, label: 'ศ' },
  { value: 6, label: 'ส' },
  { value: 7, label: 'อา' },
]

function emptyForm() {
  return {
    employeeCode: '',
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    departmentId: null as number | null,
    supervisorId: null as number | null,
    siteIds: [] as number[],
    shift: { startTime: '09:00', endTime: '18:00', graceMinutes: 0, workDays: [1, 2, 3, 4, 5] as number[] },
  }
}

const form = reactive(emptyForm())
const hasOwnShift = ref(false)
const editingId = ref<number | null>(null)
const viewingEmployee = ref<any | null>(null)
const resigningEmployee = ref<any | null>(null)

let searchTimer: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    emit('search', { search: search.value, departmentId: departmentFilter.value })
  }, 300)
}

function changePage(p: number) {
  emit('page', p)
}

function roleLabel(role: string) {
  return { EMPLOYEE: 'พนักงาน', SUPERVISOR: 'หัวหน้างาน', ADMIN: 'ผู้ดูแลระบบ' }[role] || role
}

function resignTypeLabel(type: string) {
  return { RESIGNED: 'ลาออกเอง', TERMINATED: 'เลิกจ้าง', RETIRED: 'เกษียณ', OTHER: 'อื่นๆ' }[type] || type
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatWorkDays(workDays: number[]) {
  return workDays.map((d) => weekdays.find((w) => w.value === d)?.label || d).join(' ')
}

function resetForm() {
  editingId.value = null
  hasOwnShift.value = false
  Object.assign(form, emptyForm())
}

function startEdit(emp: any) {
  editingId.value = emp.id
  hasOwnShift.value = !!emp.shift
  Object.assign(form, {
    employeeCode: emp.employeeCode,
    name: emp.name,
    email: emp.email || '',
    password: '',
    role: emp.role,
    departmentId: emp.departmentId,
    supervisorId: emp.supervisorId,
    siteIds: emp.sites.map((s: any) => s.siteId),
    shift: emp.shift
      ? { startTime: emp.shift.startTime, endTime: emp.shift.endTime, graceMinutes: emp.shift.graceMinutes, workDays: [...emp.shift.workDays] }
      : emptyForm().shift,
  })
}

async function submitEmployee() {
  error.value = ''
  const body: any = {
    employeeCode: form.employeeCode,
    name: form.name,
    email: form.email || undefined,
    role: form.role,
    departmentId: form.departmentId,
    supervisorId: form.supervisorId,
    siteIds: form.siteIds,
    shift: hasOwnShift.value ? form.shift : null,
  }
  if (form.password) body.password = form.password

  try {
    if (editingId.value) {
      await request(`/api/employees/${editingId.value}`, { method: 'PUT', body })
    } else {
      if (!form.password) {
        error.value = 'กรุณากำหนดรหัสผ่านเริ่มต้น'
        return
      }
      await request('/api/employees', { method: 'POST', body })
    }
    resetForm()
    emit('reload')
  } catch (e: any) {
    error.value = e?.data?.error || 'บันทึกไม่สำเร็จ'
  }
}

async function reactivate(id: number) {
  await request(`/api/employees/${id}/reactivate`, { method: 'POST' })
  emit('reload')
}

function onResignDone() {
  resigningEmployee.value = null
  emit('reload')
}
</script>
