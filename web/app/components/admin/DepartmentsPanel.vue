<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">เพิ่มแผนก</h2>
      <form class="flex gap-2" @submit.prevent="createDepartment">
        <input v-model="name" placeholder="ชื่อแผนก เช่น ฝ่ายขาย" class="flex-1 rounded-lg border px-3 py-2 text-sm" required />
        <button class="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">เพิ่ม</button>
      </form>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">แผนกทั้งหมด ({{ departments.length }})</h2>
      <div v-if="!departments.length" class="text-sm text-gray-500">ยังไม่มีแผนก</div>
      <ul v-else class="space-y-2">
        <li v-for="dept in departments" :key="dept.id" class="flex items-center justify-between rounded-lg border p-3 text-sm">
          <template v-if="editingId === dept.id">
            <input v-model="editName" class="mr-2 flex-1 rounded-lg border px-2 py-1 text-sm" />
            <div class="flex gap-2">
              <button class="rounded-lg bg-brand-700 px-3 py-1 text-white" @click="saveEdit(dept.id)">บันทึก</button>
              <button class="rounded-lg border px-3 py-1" @click="editingId = null">ยกเลิก</button>
            </div>
          </template>
          <template v-else>
            <span class="font-medium text-gray-900">{{ dept.name }} <span class="text-xs text-gray-400">({{ dept._count.employees }} คน)</span></span>
            <div class="flex gap-2">
              <button class="rounded-lg border px-2 py-1 text-xs" @click="startEdit(dept)">แก้ไข</button>
              <button class="rounded-lg border px-2 py-1 text-xs text-red-600" @click="remove(dept)">ลบ</button>
            </div>
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ departments: any[] }>()
const emit = defineEmits<{ reload: [] }>()

const { request } = useApi()
const { run, confirm } = useFeedback()
const name = ref('')
const editingId = ref<number | null>(null)
const editName = ref('')

async function createDepartment() {
  await run(
    async () => {
      await request('/api/departments', { method: 'POST', body: { name: name.value } })
      name.value = ''
      emit('reload')
    },
    { loading: 'กำลังเพิ่มแผนก...', success: 'เพิ่มแผนกแล้ว' }
  )
}

function startEdit(dept: any) {
  editingId.value = dept.id
  editName.value = dept.name
}

async function saveEdit(id: number) {
  await run(
    async () => {
      await request(`/api/departments/${id}`, { method: 'PUT', body: { name: editName.value } })
      editingId.value = null
      emit('reload')
    },
    { success: 'บันทึกชื่อแผนกแล้ว' }
  )
}

async function remove(dept: any) {
  if (!(await confirm({ title: `ลบแผนก "${dept.name}"?`, confirmText: 'ลบ', danger: true }))) return
  await run(
    async () => {
      await request(`/api/departments/${dept.id}`, { method: 'DELETE' })
      emit('reload')
    },
    { loading: 'กำลังลบแผนก...', success: 'ลบแผนกแล้ว' }
  )
}
</script>
