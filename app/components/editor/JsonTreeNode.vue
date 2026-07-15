<script setup lang="ts">
defineOptions({ name: 'EditorJsonTreeNode' })

const props = defineProps<{
  label: string
  value: unknown
  path: string
  depth?: number
}>()

const { document, usedVariablePaths, toggleVariable } = useWidgetEditor()
const expanded = ref((props.depth ?? 0) < 2)

const isBranch = computed(() => props.value !== null && typeof props.value === 'object')
const entries = computed(() => {
  if (!isBranch.value) return []
  if (Array.isArray(props.value)) return props.value.map((value, index) => [String(index), value] as const)
  return Object.entries(props.value as Record<string, unknown>)
})
const selected = computed(() => document.value.data.selectedPaths.includes(props.path))
const used = computed(() => usedVariablePaths.value.includes(props.path))
const enabled = computed(() => selected.value || used.value)
const valueLabel = computed(() => {
  if (props.value === null) return 'null'
  if (typeof props.value === 'string') return props.value
  return String(props.value)
})
</script>

<template>
  <div>
    <button
      v-if="isBranch"
      type="button"
      class="flex h-7 w-full items-center gap-1 rounded px-1 text-left text-xs text-toned hover:bg-muted"
      :style="{ paddingLeft: `${(depth || 0) * 12 + 4}px` }"
      @click="expanded = !expanded"
    >
      <UIcon :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-3 shrink-0 text-dimmed" />
      <UIcon :name="Array.isArray(value) ? 'i-lucide-brackets' : 'i-lucide-braces'" class="size-3.5 shrink-0 text-primary" />
      <span class="truncate font-mono">{{ label }}</span>
      <span class="ml-auto text-[10px] text-dimmed">{{ entries.length }}</span>
    </button>

    <label
      v-else
      class="flex min-h-7 items-start gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
      :class="[enabled ? 'bg-accented' : '', used ? 'cursor-default' : 'cursor-pointer']"
      :style="{ paddingLeft: `${(depth || 0) * 12 + 5}px` }"
    >
      <UCheckbox
        :model-value="enabled"
        :disabled="used"
        class="mt-0.5 shrink-0"
        @update:model-value="toggleVariable(path, $event === true)"
      />
      <span class="min-w-0 flex-1">
        <span class="font-mono text-toned">{{ label }}</span>
        <span class="ml-1 break-all text-muted">{{ valueLabel }}</span>
      </span>
      <UBadge v-if="used" label="Used" color="primary" variant="subtle" size="sm" class="shrink-0" />
    </label>

    <div v-if="isBranch && expanded">
      <EditorJsonTreeNode
        v-for="([key, child]) in entries"
        :key="key"
        :label="key"
        :value="child"
        :path="path ? `${path}.${key}` : key"
        :depth="(depth || 0) + 1"
      />
    </div>
  </div>
</template>
