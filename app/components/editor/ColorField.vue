<script setup lang="ts">
import { colorForPreview } from '~/utils/editor'
const model = defineModel<string>({ required: true })

const pickerValue = computed({
  get: () => {
    const preview = colorForPreview(model.value)
    const match = /#[0-9a-fA-F]{6}/.exec(preview)
    return match?.[0] || '#000000'
  },
  set: value => { model.value = value }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="checkerboard grid size-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-default">
      <input v-model="pickerValue" type="color" class="size-10 cursor-pointer border-0 bg-transparent p-0" aria-label="Choose color">
    </label>
    <UInput v-model="model" class="min-w-0 flex-1 font-mono" autocomplete="off" />
  </div>
</template>
