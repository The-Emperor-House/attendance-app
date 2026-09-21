<template>
  <div class="space-y-5">
    <h1 class="text-xl font-bold text-gray-900">เช็คอิน / เช็คเอาต์</h1>

    <div class="rounded-xl border bg-white p-4 shadow-sm">
      <p class="mb-2 text-sm font-medium text-gray-700">สถานะวันนี้</p>
      <div v-if="loadingToday" class="text-sm text-gray-500">กำลังโหลด...</div>
      <div v-else class="space-y-1 text-sm">
        <p>
          เช็คอิน:
          <span :class="today?.checkInAt ? 'font-medium text-brand-700' : 'text-gray-400'">
            {{ today?.checkInAt ? formatTime(today.checkInAt) : 'ยังไม่เช็คอิน' }}
          </span>
        </p>
        <p>
          เช็คเอาต์:
          <span :class="today?.checkOutAt ? 'font-medium text-brand-700' : 'text-gray-400'">
            {{ today?.checkOutAt ? formatTime(today.checkOutAt) : 'ยังไม่เช็คเอาต์' }}
          </span>
        </p>
      </div>
    </div>

    <template v-if="canAct">
      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <label class="mb-1 block text-sm font-medium text-gray-700">สถานที่</label>
        <select v-model="siteId" class="w-full rounded-lg border px-3 py-2">
          <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
        </select>
      </div>

      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <p class="mb-2 text-sm font-medium text-gray-700">ตำแหน่งปัจจุบัน</p>
        <p v-if="locationError" class="text-sm text-red-600">{{ locationError }}</p>
        <p v-else-if="!coords" class="text-sm text-gray-500">กำลังขอตำแหน่ง...</p>
        <p v-else class="text-sm text-gray-700">
          lat {{ coords.lat.toFixed(5) }}, lng {{ coords.lng.toFixed(5) }}
          <span
            v-if="distance !== null && !isOffSite"
            class="ml-2 font-medium"
            :class="withinRange ? 'text-brand-700' : 'text-orange-600'"
          >
            ({{ Math.round(distance) }} m {{ withinRange ? 'อยู่ในพื้นที่' : 'นอกพื้นที่' }})
          </span>
        </p>
        <button class="mt-2 text-sm text-brand-700 underline" @click="getLocation">รีเฟรชตำแหน่ง</button>

        <label class="mt-3 flex items-center gap-2 border-t pt-3 text-sm text-gray-700">
          <input v-model="isOffSite" type="checkbox" />
          ไปทำงานนอกสถานที่ (ลูกค้า/ประชุมนอกที่ทำงาน) — ไม่ต้องอยู่ในรัศมีที่กำหนด
        </label>
      </div>

      <div class="rounded-xl border bg-white p-4 shadow-sm">
        <p class="mb-2 text-sm font-medium text-gray-700">ถ่ายรูปยืนยันตัวตน</p>
        <video v-show="!photoBlob" ref="videoEl" class="w-full rounded-lg bg-black" autoplay playsinline muted />
        <img v-if="photoPreview" :src="photoPreview" class="w-full rounded-lg" />
        <canvas ref="canvasEl" class="hidden" />
        <div class="mt-3 flex gap-2">
          <button
            v-if="!photoBlob"
            class="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white"
            @click="capturePhoto"
          >
            ถ่ายรูป
          </button>
          <button v-else class="flex-1 rounded-lg border py-2 text-sm font-semibold text-gray-700" @click="retakePhoto">
            ถ่ายใหม่
          </button>
        </div>
      </div>

      <div v-if="!withinRange && coords && !isOffSite" class="rounded-xl border border-orange-300 bg-orange-50 p-4">
        <label class="mb-1 block text-sm font-medium text-orange-800">เหตุผล (เนื่องจากอยู่นอกพื้นที่)</label>
        <textarea v-model="note" rows="2" class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
      </div>
      <div v-if="isOffSite" class="rounded-xl border border-blue-300 bg-blue-50 p-4">
        <label class="mb-1 block text-sm font-medium text-blue-800">รายละเอียดงานนอกสถานที่</label>
        <textarea v-model="note" rows="2" placeholder="เช่น ไปพบลูกค้า, ประชุมที่บริษัท ABC" class="w-full rounded-lg border px-3 py-2 text-sm"></textarea>
      </div>

      <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

      <button
        class="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-50"
        :class="nextAction === 'CHECK_IN' ? 'bg-brand-700' : 'bg-gray-800'"
        :disabled="!canSubmit || submitting"
        @click="submitAttendance"
      >
        {{ nextAction === 'CHECK_IN' ? 'เช็คอิน' : 'เช็คเอาต์' }}
      </button>
    </template>

    <div v-else class="rounded-xl border border-brand-300 bg-brand-50 p-4 text-sm text-brand-800">
      วันนี้เช็คอิน-เอาต์ครบแล้ว หากมีข้อผิดพลาดกรุณาติดต่อ HR เพื่อแก้ไข
    </div>
  </div>
</template>

<script setup lang="ts">
interface Site {
  id: number
  name: string
  lat: number
  lng: number
  radiusM: number
}

interface TodayRecord {
  id: number
  siteId: number
  checkInAt: string | null
  checkOutAt: string | null
}

const { request } = useApi()

const sites = ref<Site[]>([])
const siteId = ref<number | null>(null)
const coords = ref<{ lat: number; lng: number } | null>(null)
const locationError = ref('')
const note = ref('')
const isOffSite = ref(false)

const today = ref<TodayRecord | null>(null)
const loadingToday = ref(true)

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const photoBlob = ref<Blob | null>(null)
const photoPreview = ref<string | null>(null)
let mediaStream: MediaStream | null = null

const submitting = ref(false)
const submitError = ref('')

const nextAction = computed<'CHECK_IN' | 'CHECK_OUT'>(() =>
  today.value?.checkInAt ? 'CHECK_OUT' : 'CHECK_IN'
)
const canAct = computed(() => !today.value?.checkInAt || !today.value?.checkOutAt)

const selectedSite = computed(() => sites.value.find((s) => s.id === siteId.value) || null)

const distance = computed(() => {
  if (!coords.value || !selectedSite.value) return null
  return haversine(coords.value.lat, coords.value.lng, selectedSite.value.lat, selectedSite.value.lng)
})

const withinRange = computed(() => {
  if (distance.value === null || !selectedSite.value) return false
  return distance.value <= selectedSite.value.radiusM
})

const canSubmit = computed(() => !!coords.value && !!photoBlob.value && !!siteId.value)

watch(nextAction, () => {
  isOffSite.value = false
})

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getLocation() {
  locationError.value = ''
  if (!navigator.geolocation) {
    locationError.value = 'อุปกรณ์นี้ไม่รองรับ GPS'
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    },
    (err) => {
      locationError.value = 'ไม่สามารถขอตำแหน่งได้: ' + err.message
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    if (videoEl.value) videoEl.value.srcObject = mediaStream
  } catch {
    submitError.value = 'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง'
  }
}

function capturePhoto() {
  if (!videoEl.value || !canvasEl.value) return
  const video = videoEl.value
  const canvas = canvasEl.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob(
    (blob) => {
      if (blob) {
        photoBlob.value = blob
        photoPreview.value = URL.createObjectURL(blob)
      }
    },
    'image/jpeg',
    0.85
  )
}

function retakePhoto() {
  photoBlob.value = null
  photoPreview.value = null
}

async function loadToday() {
  loadingToday.value = true
  try {
    today.value = await request<TodayRecord | null>('/api/attendance/today')
    if (today.value?.siteId) siteId.value = today.value.siteId
  } finally {
    loadingToday.value = false
  }
}

async function submitAttendance() {
  submitError.value = ''
  if (!coords.value || !photoBlob.value || !siteId.value) return

  submitting.value = true
  try {
    const form = new FormData()
    form.append('siteId', String(siteId.value))
    form.append('lat', String(coords.value.lat))
    form.append('lng', String(coords.value.lng))
    if (note.value) form.append('note', note.value)
    if (isOffSite.value) form.append('isOffSite', 'true')
    form.append('photo', photoBlob.value, 'checkin.jpg')

    const path = nextAction.value === 'CHECK_IN' ? '/api/attendance/check-in' : '/api/attendance/check-out'
    today.value = await request(path, { method: 'POST', body: form })
    retakePhoto()
    note.value = ''
    isOffSite.value = false
  } catch (e: any) {
    submitError.value = e?.data?.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadToday()
  getLocation()
  await startCamera()
  try {
    sites.value = await request<Site[]>('/api/sites')
    if (!siteId.value && sites.value.length) siteId.value = sites.value[0].id
  } catch {
    submitError.value = 'โหลดรายชื่อสถานที่ไม่สำเร็จ'
  }
})

onBeforeUnmount(() => {
  mediaStream?.getTracks().forEach((t) => t.stop())
})
</script>
