<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold text-gray-900">จัดการ</h1>

    <div class="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 text-sm">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="shrink-0 rounded-lg px-3 py-2 font-medium transition"
        :class="activeTab === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <AdminSitesPanel v-if="activeTab === 'sites'" :sites="sites" @reload="loadAll" />

    <AdminDepartmentsPanel v-else-if="activeTab === 'departments'" :departments="departments" @reload="loadAll" />

    <AdminEmployeesPanel
      v-else-if="activeTab === 'employees'"
      :employees="employees"
      :all-employees="allEmployees"
      :sites="sites"
      :departments="departments"
      :total="employeeTotal"
      :page="employeePage"
      :page-size="employeePageSize"
      @reload="loadAll"
      @search="onEmployeeSearch"
      @page="onEmployeePage"
    />

    <AdminAttendancePanel v-else-if="activeTab === 'attendance'" />

    <AdminLeavePanel v-else-if="activeTab === 'leave'" :employees="allEmployees" :can-manage="isAdmin" />

    <AdminCorrectionsPanel v-else-if="activeTab === 'corrections'" />

    <AdminReportsPanel v-else :departments="departments" />
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const auth = useAuthStore()

// Supervisors share this page but only for their team's attendance, corrections,
// leave approvals and reports; the other tabs call ADMIN-only APIs.
const isAdmin = computed(() => auth.user?.role === 'ADMIN')

const allTabs = [
  { key: 'sites', label: 'สถานที่', adminOnly: true },
  { key: 'departments', label: 'แผนก', adminOnly: true },
  { key: 'employees', label: 'พนักงาน', adminOnly: true },
  { key: 'attendance', label: 'บันทึกเวลา', adminOnly: false },
  { key: 'corrections', label: 'คำขอแก้ไขเวลา', adminOnly: false },
  { key: 'leave', label: 'ลา/วันหยุด', adminOnly: false },
  { key: 'reports', label: 'รายงาน', adminOnly: false },
] as const

const tabs = computed(() =>
  allTabs
    .filter((t) => isAdmin.value || !t.adminOnly)
    .map((t) => (t.key === 'leave' && !isAdmin.value ? { ...t, label: 'อนุมัติการลา' } : t))
)

const activeTab = ref<(typeof allTabs)[number]['key']>(isAdmin.value ? 'sites' : 'attendance')

const sites = ref<any[]>([])
const departments = ref<any[]>([])

const employees = ref<any[]>([])
const allEmployees = ref<any[]>([])
const employeeTotal = ref(0)
const employeePage = ref(1)
const employeePageSize = ref(20)
const employeeSearch = ref('')
const employeeDepartmentFilter = ref<string | number>('')

async function loadEmployees() {
  const params = new URLSearchParams({ page: String(employeePage.value), pageSize: String(employeePageSize.value) })
  if (employeeSearch.value) params.set('search', employeeSearch.value)
  if (employeeDepartmentFilter.value) params.set('departmentId', String(employeeDepartmentFilter.value))
  const res = await request<any>(`/api/employees?${params.toString()}`)
  employees.value = res.data
  employeeTotal.value = res.total
}

function onEmployeeSearch(payload: { search: string; departmentId: string | number }) {
  employeeSearch.value = payload.search
  employeeDepartmentFilter.value = payload.departmentId
  employeePage.value = 1
  loadEmployees()
}

function onEmployeePage(p: number) {
  employeePage.value = p
  loadEmployees()
}

async function loadAll() {
  departments.value = await request('/api/departments')
  if (!isAdmin.value) return
  sites.value = await request('/api/sites')
  const all = await request<any>('/api/employees?pageSize=100')
  allEmployees.value = all.data
  await loadEmployees()
}

onMounted(loadAll)
</script>
