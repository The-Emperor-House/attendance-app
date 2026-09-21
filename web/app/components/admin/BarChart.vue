<template>
  <div class="space-y-2">
    <div v-for="item in items" :key="item.label" class="text-sm">
      <div class="mb-0.5 flex items-center justify-between text-xs text-gray-600">
        <span class="truncate">{{ item.label }}</span>
        <span class="shrink-0 font-medium text-gray-800">{{ item.display }}</span>
      </div>
      <div class="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full transition-all"
          :class="item.colorClass || 'bg-orange-500'"
          :style="{ width: `${max ? Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0) : 0}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  items: { label: string; value: number; display: string; colorClass?: string }[]
}>()

const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>
