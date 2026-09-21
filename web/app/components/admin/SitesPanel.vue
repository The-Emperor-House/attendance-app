<template>
  <div class="space-y-4">
    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">{{ editingSiteId ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่' }}</h2>
      <form class="space-y-2" @submit.prevent="submitSite">
        <input v-model="form.name" placeholder="ชื่อสถานที่" class="w-full rounded-lg border px-3 py-2 text-sm" required />
        <input v-model="form.address" placeholder="ที่อยู่ (ไม่บังคับ)" class="w-full rounded-lg border px-3 py-2 text-sm" />

        <div class="grid grid-cols-2 gap-2">
          <input v-model.number="form.lat" type="number" step="any" placeholder="lat" class="rounded-lg border px-3 py-2 text-sm" required />
          <input v-model.number="form.lng" type="number" step="any" placeholder="lng" class="rounded-lg border px-3 py-2 text-sm" required />
        </div>
        <button
          type="button"
          class="w-full rounded-lg border border-brand-700 py-2 text-sm font-medium text-brand-700 disabled:opacity-50"
          :disabled="locating"
          @click="useCurrentLocation"
        >
          {{ locating ? 'กำลังขอตำแหน่ง...' : '📍 ใช้ตำแหน่งปัจจุบัน' }}
        </button>
        <p class="text-xs text-gray-500">
          หาพิกัดเองได้จาก Google Maps: คลิกขวาที่จุดบนแผนที่ → คัดลอกตัวเลข lat, lng ที่ขึ้นด้านบน (เช่น 13.7563, 100.5018)
          หรือกดปุ่มด้านบนถ้ากำลังยืนอยู่ที่สถานที่จริง
        </p>
        <input v-model.number="form.radiusM" type="number" placeholder="รัศมีอนุญาต (เมตร) เช่น 150" class="w-full rounded-lg border px-3 py-2 text-sm" />

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">
            {{ editingSiteId ? 'บันทึกการแก้ไข' : 'เพิ่มสถานที่' }}
          </button>
          <button v-if="editingSiteId" type="button" class="rounded-lg border px-4 py-2 text-sm" @click="resetForm">ยกเลิก</button>
        </div>
      </form>
    </section>

    <section class="rounded-xl border bg-white p-4 shadow-sm">
      <h2 class="mb-3 font-semibold text-gray-900">สถานที่ทั้งหมด ({{ sites.length }})</h2>
      <div v-if="!sites.length" class="text-sm text-gray-500">ยังไม่มีสถานที่</div>
      <ul v-else class="space-y-2">
        <li v-for="site in sites" :key="site.id" class="rounded-lg border p-3 text-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-medium text-gray-900">{{ site.name }}</p>
              <p class="text-xs text-gray-500">{{ site.lat }}, {{ site.lng }} · รัศมี {{ site.radiusM }}m</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button class="rounded-lg border px-2 py-1 text-xs" @click="editSite(site)">แก้ไข</button>
              <button class="rounded-lg border px-2 py-1 text-xs text-red-600" @click="removeSite(site.id)">ลบ</button>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ sites: any[] }>()
const emit = defineEmits<{ reload: [] }>()

const { request } = useApi()

const editingSiteId = ref<number | null>(null)
const locating = ref(false)
const error = ref('')

function emptyForm() {
  return {
    name: '',
    address: '',
    lat: null as number | null,
    lng: null as number | null,
    radiusM: 150,
  }
}

const form = reactive(emptyForm())

function resetForm() {
  editingSiteId.value = null
  Object.assign(form, emptyForm())
}

function editSite(site: any) {
  editingSiteId.value = site.id
  Object.assign(form, {
    name: site.name,
    address: site.address || '',
    lat: site.lat,
    lng: site.lng,
    radiusM: site.radiusM,
  })
}

function useCurrentLocation() {
  if (!navigator.geolocation) return
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.lat = Number(pos.coords.latitude.toFixed(6))
      form.lng = Number(pos.coords.longitude.toFixed(6))
      locating.value = false
    },
    () => {
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function submitSite() {
  error.value = ''
  const body = {
    name: form.name,
    address: form.address || undefined,
    lat: form.lat,
    lng: form.lng,
    radiusM: form.radiusM,
  }
  try {
    if (editingSiteId.value) {
      await request(`/api/sites/${editingSiteId.value}`, { method: 'PUT', body })
    } else {
      await request('/api/sites', { method: 'POST', body })
    }
    resetForm()
    emit('reload')
  } catch (e: any) {
    error.value = e?.data?.error || 'บันทึกไม่สำเร็จ'
  }
}

async function removeSite(id: number) {
  error.value = ''
  try {
    await request(`/api/sites/${id}`, { method: 'DELETE' })
    emit('reload')
  } catch (e: any) {
    error.value = e?.data?.error || 'ลบไม่สำเร็จ'
  }
}
</script>
