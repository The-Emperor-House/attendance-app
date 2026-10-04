<template>
  <div class="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" @click.self="$emit('close')">
    <div class="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
      <div class="mb-3 flex items-start justify-between">
        <h2 class="font-semibold text-gray-900">{{ visit ? 'ขอแก้ไขเวลา' : 'แจ้งลืมเช็คอิน' }}</h2>
        <button class="text-gray-400" @click="$emit('close')">✕</button>
      </div>

      <form class="space-y-3" @submit.prevent="submit">
        <!-- FIX_VISIT: the visit being corrected -->
        <div v-if="visit" class="rounded-lg bg-gray-50 p-3 text-sm">
          <p class="font-medium text-gray-900">{{ visit.site.name }}</p>
          <p class="text-xs text-gray-500">
            {{ formatDate(visit.date) }} · บันทึกไว้ {{ visit.checkInAt ? formatTime(visit.checkInAt) : '-' }} –
            {{ visit.checkOutAt ? formatTime(visit.checkOutAt) : 'ยังไม่เช็คเอาต์' }}
          </p>
        </div>

        <!-- ADD_VISIT: where and when -->
        <template v-else>
          <div>
            <label class="mb-1 block text-xs text-gray-500">สถานที่</label>
            <select v-model="form.siteId" required class="w-full rounded-lg border px-3 py-2 text-sm">
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">วันที่</label>
            <input v-model="form.date" type="date" :min="minDate" :max="maxDate" required class="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
        </template>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1 block text-xs text-gray-500">เวลาเช็คอิน{{ visit ? ' (ถ้าจะแก้)' : '' }}</label>
            <TimeInput v-model="form.checkInTime" :required="!visit" class="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500">เวลาเช็คเอาต์{{ visit ? ' (ถ้าจะแก้)' : '' }}</label>
            <TimeInput v-model="form.checkOutTime" :required="!visit" class="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
        </div>
        <p class="text-xs text-gray-500">ถ้าเวลาเช็คเอาต์น้อยกว่าเวลาเช็คอิน ระบบจะถือว่าเป็นวันถัดไป (กะข้ามคืน)</p>

        <div>
          <label class="mb-1 block text-xs text-gray-500">เหตุผล</label>
          <textarea
            v-model="form.reason"
            rows="2"
            required
            placeholder="เช่น ลืมเช็คเอาต์ก่อนย้ายไปไซต์ B"
            class="w-full rounded-lg border px-3 py-2 text-sm"
          ></textarea>
        </div>

        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">ส่งคำขอ</button>
          <button type="button" class="rounded-lg border px-4 py-2 text-sm" @click="$emit('close')">ยกเลิก</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// Employee's request to correct their own attendance (FIX_VISIT when `visit` is given,
// otherwise ADD_VISIT for a visit that was never checked in). A supervisor approves it.
const props = defineProps<{ visit: any | null; sites: any[] }>()
const emit = defineEmits<{ close: []; done: [] }>()

const { request } = useApi()
const { run, showError } = useFeedback()

// Must match MAX_DAYS_BACK in server/src/routes/corrections.js.
const MAX_DAYS_BACK = 30

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const maxDate = bangkokDate(new Date())
const minDate = bangkokDate(new Date(Date.now() - MAX_DAYS_BACK * 86400000))

const form = reactive({
  siteId: props.sites[0]?.id ?? null,
  date: maxDate,
  checkInTime: '',
  checkOutTime: '',
  reason: '',
})

async function submit() {
  if (props.visit && !form.checkInTime && !form.checkOutTime) {
    showError('กรุณาระบุเวลาที่ต้องการแก้ไขอย่างน้อย 1 ช่อง')
    return
  }
  const body = props.visit
    ? {
        type: 'FIX_VISIT',
        attendanceId: props.visit.id,
        checkInTime: form.checkInTime || undefined,
        checkOutTime: form.checkOutTime || undefined,
        reason: form.reason,
      }
    : {
        type: 'ADD_VISIT',
        siteId: form.siteId,
        date: form.date,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        reason: form.reason,
      }

  await run(
    async () => {
      await request('/api/corrections', { method: 'POST', body })
      emit('done')
    },
    { loading: 'กำลังส่งคำขอแก้ไขเวลา...', success: 'ส่งคำขอแล้ว รอหัวหน้าอนุมัติ' }
  )
}
</script>
