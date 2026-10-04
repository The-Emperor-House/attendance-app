<template>
  <input
    :value="modelValue"
    type="text"
    inputmode="numeric"
    placeholder="HH:MM"
    maxlength="5"
    pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
    title="เวลาแบบ 24 ชั่วโมง เช่น 08:30 หรือ 17:45"
    autocomplete="off"
    @input="onInput"
    @blur="onBlur"
  />
</template>

<script setup lang="ts">
// A 24-hour "HH:MM" text field. <input type="time"> follows the device locale and
// shows AM/PM on many phones, which HTML can't turn off.
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// Keep digits only and insert the colon as the user types: "0830" -> "08:30".
function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 4)
  const value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
  input.value = value
  emit('update:modelValue', value)
}

// "8" -> "08:00", "830" -> "08:30", so a short entry still becomes a valid time.
function onBlur() {
  const digits = props.modelValue.replace(/\D/g, '')
  if (!digits) return
  let value = props.modelValue
  if (digits.length <= 2) value = `${digits.padStart(2, '0')}:00`
  else if (digits.length === 3) value = `0${digits[0]}:${digits.slice(1)}`
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>
