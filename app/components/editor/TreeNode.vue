<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ElementType, StackProperties, WidgetElement } from '~/types/editor'
import { ELEMENT_ICONS, ELEMENT_LABELS } from '~/utils/editor'

defineOptions({ name: 'EditorTreeNode' })

const props = defineProps<{
  element: WidgetElement
  depth?: number
}>()

const {
  selectedElementId,
  selectElement,
  addElement,
  removeElement,
  duplicateElement,
  moveElement
} = useWidgetEditor()

const renaming = ref(false)
const renameInput = ref<HTMLInputElement | null>(null)
const childList = ref<HTMLElement | null>(null)
const canContainChildren = computed(() => ['widget', 'verticalStack', 'horizontalStack'].includes(props.element.type))
const hasChildren = computed(() => props.element.children.length > 0)
const repeatCount = computed(() => {
  if (props.element.type !== 'verticalStack' && props.element.type !== 'horizontalStack') return 1
  return (props.element.properties as StackProperties).repeatCount || 1
})

useLayerTreeSortable(childList, () => props.element.id)

const childTypes: ElementType[] = ['verticalStack', 'horizontalStack', 'text', 'image', 'date', 'spacer']

const addItems = computed<DropdownMenuItem[]>(() => childTypes.map(type => ({
  label: ELEMENT_LABELS[type],
  icon: ELEMENT_ICONS[type],
  onSelect: () => addElement(props.element.id, type)
})))

const actionItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Move up', icon: 'i-lucide-arrow-up', onSelect: () => moveElement(props.element.id, -1) },
    { label: 'Move down', icon: 'i-lucide-arrow-down', onSelect: () => moveElement(props.element.id, 1) },
    { label: 'Rename', icon: 'i-lucide-pencil', onSelect: startRename },
    { label: 'Duplicate', icon: 'i-lucide-copy', onSelect: () => duplicateElement(props.element.id) }
  ],
  [
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeElement(props.element.id) }
  ]
])

function toggleCollapsed() {
  if (hasChildren.value) props.element.collapsed = !props.element.collapsed
}

async function startRename() {
  renaming.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function finishRename() {
  props.element.name = props.element.name.trim() || ELEMENT_LABELS[props.element.type]
  renaming.value = false
}

</script>

<template>
  <div
    :data-layer-sortable-item="element.type === 'widget' ? undefined : ''"
    :data-layer-element-id="element.type === 'widget' ? undefined : element.id"
  >
    <div
      class="studio-tree-row group flex min-h-11 items-center gap-0.5 pr-1 text-sm transition-colors lg:h-8 lg:min-h-0 lg:gap-1"
      :class="selectedElementId === element.id ? 'studio-tree-row-selected bg-primary/10 text-highlighted' : 'text-toned hover:bg-muted'"
      :style="{ paddingLeft: `${(depth || 0) * 14 + 4}px` }"
      @click="selectElement(element.id)"
    >
      <button
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded text-dimmed hover:text-default lg:size-5"
        :aria-label="element.collapsed ? 'Expand layer' : 'Collapse layer'"
        @click.stop="toggleCollapsed"
      >
        <UIcon
          v-if="hasChildren"
          :name="element.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
          class="size-3.5"
        />
      </button>

      <UIcon
        :name="ELEMENT_ICONS[element.type]"
        class="size-4 shrink-0"
        :class="element.type === 'widget' ? '' : 'cursor-grab active:cursor-grabbing'"
        :data-layer-drag-handle="element.type === 'widget' ? undefined : ''"
      />

      <UButton
        v-if="element.type !== 'widget'"
        icon="i-lucide-grip-vertical"
        color="neutral"
        variant="ghost"
        size="xs"
        class="size-9 cursor-grab justify-center p-0 opacity-75 active:cursor-grabbing lg:size-auto lg:opacity-45 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
        :aria-label="`Move ${element.name}`"
        data-layer-drag-handle
        @click.stop
      />

      <input
        v-if="renaming"
        ref="renameInput"
        v-model="element.name"
        class="min-w-0 flex-1 rounded border border-primary bg-default px-1 text-sm outline-none"
        @click.stop
        @keydown.enter="finishRename"
        @keydown.escape="renaming = false"
        @blur="finishRename"
      >
      <span
        v-else
        class="min-w-0 flex-1 truncate"
        :class="element.type === 'widget' ? '' : 'cursor-grab active:cursor-grabbing'"
        :data-layer-drag-handle="element.type === 'widget' ? undefined : ''"
        @dblclick.stop="startRename"
      >{{ element.name }}</span>

      <UBadge v-if="repeatCount > 1" :label="`×${repeatCount}`" color="primary" variant="subtle" size="sm" />

      <UDropdownMenu v-if="canContainChildren" :items="addItems" :content="{ align: 'start' }">
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="xs"
          class="size-9 justify-center p-0 opacity-100 lg:size-auto lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          aria-label="Add child"
          @click.stop
        />
      </UDropdownMenu>

      <UDropdownMenu v-if="element.type !== 'widget'" :items="actionItems" :content="{ align: 'start' }">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="xs"
          class="size-9 justify-center p-0 opacity-100 lg:size-auto lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          aria-label="Layer actions"
          @click.stop
        />
      </UDropdownMenu>
    </div>

    <div
      v-if="canContainChildren"
      ref="childList"
      class="layer-drop-list"
      :class="element.collapsed ? 'layer-drop-list-collapsed' : ''"
      :data-layer-parent-id="element.id"
      :style="{ '--layer-drop-indent': `${((depth || 0) + 1) * 14 + 24}px` }"
    >
      <EditorTreeNode
        v-for="child in element.collapsed ? [] : element.children"
        :key="child.id"
        :element="child"
        :depth="(depth || 0) + 1"
      />
    </div>
  </div>
</template>
