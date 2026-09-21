<template>
  <div class="space-y-5">
    <h1 class="text-xl font-bold text-gray-900">ลางาน</h1>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">โควตาวันลาปีนี้</h2>
      <div v-if="quotaLoading" class="text-sm text-gray-500">กำลังโหลด...</div>
      <div v-else class="grid grid-cols-3 gap-2 text-center">
        <div v-for="q in quota" :key="q.type" class="rounded-lg bg-brand-50 p-2">
          <p class="text-xs text-gray-500">{{ q.name }}</p>
          <p class="text-lg font-semibold text-brand-700">{{ q.remaining }}</p>
          <p class="text-xs text-gray-400">จาก {{ q.quota }} วัน</p>
        </div>
      </div>
    </div>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">ยื่นคำขอลา</h2>
      <form class="space-y-2" @submit.prevent="submit">
        <select v-model="form.type" class="w-full rounded-lg border px-3 py-2 text-sm">
          <option v-for="c in activeCategories" :key="c.code" :value="c.code">{{ c.name }}</option>
        </select>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1 block text-xs text-gray-500">วันที่เริ่ม</label>
            <input v-model="form.startDate" type="date" class="w-full rounded-lg border px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">วันที่สิ้นสุด</label>
            <input v-model="form.endDate" type="date" class="w-full rounded-lg border px-3 py-2 text-sm" required />
          </div>
        </div>
        <textarea v-model="form.reason" rows="2" placeholder="เหตุผล (ไม่บังคับ)" class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button class="w-full rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">ส่งคำขอ</button>
      </form>
    </div>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">ประวัติการลา</h2>
      <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด...</div>
      <div v-else-if="!leaves.length" class="text-sm text-gray-500">ยังไม่มีคำขอลา</div>
      <ul v-else class="space-y-2">
        <li v-for="leave in leaves" :key="leave.id" class="rounded-lg border p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ typeLabel(leave.type) }}</span>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusClass(leave.status)">
              {{ statusLabel(leave.status) }}
            </span>
          </div>
          <p class="text-xs text-gray-500">{{ formatDate(leave.startDate) }} – {{ formatDate(leave.endDate) }}</p>
          <p v-if="leave.reason" class="mt-1 text-gray-600">{{ leave.reason }}</p>
          <p v-if="leave.approverNote" class="mt-1 text-xs text-gray-500">หมายเหตุจากผู้อนุมัติ: {{ leave.approverNote }}</p>
          <button
            v-if="leave.status === 'PENDING'"
            class="mt-2 rounded-lg border px-3 py-1 text-xs text-red-600"
            @click="cancel(leave.id)"
          >
            ยกเลิกคำขอ
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()

const leaves = ref<any[]>([])
const loading = ref(true)
const error = ref('')

const quota = ref<{ type: string; name: string; quota: number; used: number; remaining: number }[]>([])
const quotaLoading = ref(true)

const categories = ref<{ code: string; name: string; active: boolean }[]>([])
const activeCategories = computed(() => categories.value.filter((c) => c.active))
const categoryMap = computed(() => Object.fromEntries(categories.value.map((c) => [c.code, c.name])))

const form = reactive({
  type: '',
  startDate: '',
  endDate: '',
  reason: '',
})

function typeLabel(type: string) {
  return categoryMap.value[type] || type
}

async function loadCategories() {
  categories.value = await request('/api/leave-categories?all=true')
  if (!form.type && activeCategories.value.length) form.type = activeCategories.value[0].code
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

async function load() {
  loading.value = true
  try {
    leaves.value = await request('/api/leaves/me')
  } finally {
    loading.value = false
  }
}

async function loadQuota() {
  quotaLoading.value = true
  try {
    const res = await request<{ summary: typeof quota.value }>('/api/leave-quota/me')
    quota.value = res.summary
  } finally {
    quotaLoading.value = false
  }
}

async function submit() {
  error.value = ''
  try {
    await request('/api/leaves', {
      method: 'POST',
      body: { ...form, reason: form.reason || undefined },
    })
    Object.assign(form, { type: activeCategories.value[0]?.code || '', startDate: '', endDate: '', reason: '' })
    await Promise.all([load(), loadQuota()])
  } catch (e: any) {
    error.value = e?.data?.error || 'ส่งคำขอไม่สำเร็จ'
  }
}

async function cancel(id: number) {
  await request(`/api/leaves/${id}`, { method: 'DELETE' })
  await Promise.all([load(), loadQuota()])
}

onMounted(() => {
  load()
  loadQuota()
  loadCategories()
})
</script>
