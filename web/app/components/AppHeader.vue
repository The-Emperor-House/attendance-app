<template>
  <header class="sticky top-0 z-20 border-b border-brand-100 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-md items-center justify-between px-4 py-3">
      <p class="text-base font-semibold tracking-tight text-brand-800">เช็คอิน<span class="text-brand-500">.</span></p>

      <div class="flex items-center gap-3">
        <NuxtLink
          to="/account"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 transition hover:bg-brand-200"
          :title="auth.user?.name"
        >
          {{ initials }}
        </NuxtLink>
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          title="ออกจากระบบ"
          @click="logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M18 12H8.25m0 0 3-3m-3 3 3 3" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const router = useRouter()

const initials = computed(() => (auth.user?.name || '?').trim().charAt(0).toUpperCase())

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
