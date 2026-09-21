<template>
  <div class="min-h-screen bg-[#f7faf6]">
    <NuxtRouteAnnouncer />
    <AppHeader v-if="auth.isAuthenticated" />
    <main class="mx-auto max-w-md px-4 py-6" :class="auth.isAuthenticated ? 'pb-24' : ''">
      <NuxtPage />
    </main>
    <BottomNav v-if="auth.isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
onMounted(() => auth.hydrate())
</script>
