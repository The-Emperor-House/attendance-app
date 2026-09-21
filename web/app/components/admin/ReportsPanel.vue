<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">สถิติการมาสาย</h2>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <select v-model="scope" class="rounded-lg border px-2 py-2 text-sm" @change="load">
          <option value="month">รายเดือน</option>
          <option value="year">รายปี</option>
        </select>
        <select v-if="scope === 'month'" v-model.number="month" class="rounded-lg border px-2 py-2 text-sm" @change="load">
          <option v-for="m in 12" :key="m" :value="m">เดือน {{ m }}</option>
        </select>
        <select v-model.number="year" class="rounded-lg border px-2 py-2 text-sm" @change="load">
          <option v-for="y in years" :key="y" :value="y">ปี {{ y }}</option>
        </select>
        <select v-model="departmentFilter" class="rounded-lg border px-2 py-2 text-sm" @change="load">
          <option value="">ทุกแผนก</option>
          <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
        </select>
        <select v-model.number="employeeLimit" class="rounded-lg border px-2 py-2 text-sm" @change="load">
          <option :value="10">แสดง 10 คน</option>
          <option :value="20">แสดง 20 คน</option>
          <option :value="50">แสดง 50 คน</option>
        </select>
        <button type="button" class="ml-auto rounded-lg border px-3 py-2 text-xs text-brand-700" @click="downloadExport">
          ดาวน์โหลด Excel
        </button>
      </div>

      <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด...</div>
      <template v-else>
        <h3 class="mb-2 text-sm font-semibold text-gray-700">อันดับแผนกที่มาสายมากที่สุด (% ของการเช็คอินทั้งหมด)</h3>
        <div v-if="!departments_.length" class="mb-4 text-sm text-gray-500">ไม่มีข้อมูล</div>
        <AdminBarChart v-else class="mb-4" :items="deptChartItems" />

        <div v-if="departments_.length" class="mb-4 space-y-2">
          <div v-for="d in departments_" :key="d.departmentId" class="rounded-lg border p-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="font-medium text-gray-900">{{ d.departmentName }}</span>
              <span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                สาย {{ d.lateCount }}/{{ d.totalCheckIns }} ({{ d.latePercent }}%)
              </span>
            </div>
            <button class="mt-1 text-xs text-brand-700 underline" @click="expanded = expanded === d.departmentId ? null : d.departmentId">
              {{ expanded === d.departmentId ? 'ซ่อนรายเดือน' : 'ดูรายเดือน' }}
            </button>
            <AdminBarChart
              v-if="expanded === d.departmentId && d.monthly?.length"
              class="mt-2"
              :items="
                d.monthly.map((m: any) => ({
                  label: `เดือน ${m.month}`,
                  value: m.lateCount,
                  display: `${m.lateCount}/${m.totalCheckIns}`,
                }))
              "
            />
          </div>
        </div>

        <h3 class="mb-2 text-sm font-semibold text-gray-700">
          อันดับพนักงานที่มาสายมากที่สุด
          <span class="font-normal text-gray-400">(แสดง {{ employees.length }} จาก {{ employeeTotal }} คน)</span>
        </h3>
        <div v-if="!employees.length" class="text-sm text-gray-500">ไม่มีข้อมูล</div>
        <AdminBarChart
          v-else
          :items="
            employees.map((e) => ({
              label: `${e.employeeName} (${e.departmentName})`,
              value: e.lateCount,
              display: `${e.lateCount}/${e.totalCheckIns} (${e.latePercent}%)`,
            }))
          "
        />
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ departments: any[] }>()

const { request } = useApi()
const { download } = useExportDownload()

const now = new Date()
const scope = ref<'month' | 'year'>('month')
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
const departmentFilter = ref<string | number>('')
const employeeLimit = ref(10)

const departments_ = ref<any[]>([])
const employees = ref<any[]>([])
const employeeTotal = ref(0)
const expanded = ref<number | null>(null)
const loading = ref(true)

const deptChartItems = computed(() =>
  departments_.value.map((d) => ({
    label: d.departmentName,
    value: d.latePercent,
    display: `${d.latePercent}%`,
  }))
)

function downloadExport() {
  const params: Record<string, string> = { year: String(year.value) }
  if (scope.value === 'month') params.month = String(month.value)
  if (departmentFilter.value) params.departmentId = String(departmentFilter.value)
  download('/api/reports/late-stats/export', params)
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ year: String(year.value), employeeLimit: String(employeeLimit.value) })
    if (scope.value === 'month') params.set('month', String(month.value))
    if (departmentFilter.value) params.set('departmentId', String(departmentFilter.value))
    const res = await request<any>(`/api/reports/late-stats?${params.toString()}`)
    departments_.value = res.departments
    employees.value = res.employees
    employeeTotal.value = res.employeeTotal
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
