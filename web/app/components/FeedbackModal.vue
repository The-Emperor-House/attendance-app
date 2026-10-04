<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="state.phase !== 'idle'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      @click.self="onBackdrop"
    >
      <div
        class="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
        role="dialog"
        aria-modal="true"
        :aria-busy="state.phase === 'loading'"
      >
        <!-- Loading: can't be dismissed, so the user can't fire the same save twice. -->
        <template v-if="state.phase === 'loading'">
          <div class="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
          <p class="font-medium text-gray-900" aria-live="polite">{{ state.message }}</p>
          <p v-if="state.slow" class="mt-2 text-xs text-gray-500">
            ใช้เวลานานกว่าปกติ อาจเป็นเพราะอินเทอร์เน็ตช้า ระบบยังทำงานอยู่ กรุณาอย่าปิดหน้านี้
          </p>
        </template>

        <template v-else-if="state.phase === 'success'">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">✓</div>
          <p class="font-semibold text-gray-900">{{ state.title }}</p>
          <p v-if="state.message" class="mt-1 text-sm text-gray-600">{{ state.message }}</p>
        </template>

        <template v-else-if="state.phase === 'error'">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">!</div>
          <p class="font-semibold text-gray-900">{{ state.title }}</p>
          <p class="mt-1 whitespace-pre-line break-words text-sm text-gray-600">{{ state.message }}</p>
          <button ref="primaryBtn" class="mt-4 w-full rounded-lg bg-gray-800 py-2 text-sm font-semibold text-white" @click="close">
            ตกลง
          </button>
        </template>

        <template v-else-if="state.phase === 'confirm'">
          <p class="font-semibold text-gray-900">{{ state.title }}</p>
          <p v-if="state.message" class="mt-1 text-sm text-gray-600">{{ state.message }}</p>
          <div class="mt-4 flex gap-2">
            <button class="flex-1 rounded-lg border py-2 text-sm" @click="answerConfirm(false)">ยกเลิก</button>
            <button
              ref="primaryBtn"
              class="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
              :class="state.danger ? 'bg-red-600' : 'bg-brand-700'"
              @click="answerConfirm(true)"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { state, close, answerConfirm } = useFeedback()
const primaryBtn = ref<HTMLButtonElement | null>(null)

function onBackdrop() {
  if (state.value.phase === 'confirm') answerConfirm(false)
  else if (state.value.phase !== 'loading') close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') onBackdrop()
}

// Focus the main button so Enter/Escape work without reaching for the mouse.
watch(
  () => state.value.phase,
  async (phase) => {
    if (phase === 'error' || phase === 'confirm') {
      await nextTick()
      primaryBtn.value?.focus()
    }
  }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
