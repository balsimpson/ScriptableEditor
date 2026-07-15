<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ElementType } from '~/types/editor'
import { ELEMENT_ICONS, ELEMENT_LABELS } from '~/utils/editor'

const { document, activeRoot, activeSize, treeDraggingId, addElement, templatePickerOpen, openTemplatePicker } = useWidgetEditor()
const hasData = computed(() => document.value.data.sampleData !== undefined)
const types: ElementType[] = ['verticalStack', 'horizontalStack', 'text', 'image', 'date', 'spacer']
const addItems: DropdownMenuItem[] = types.map(type => ({
  label: ELEMENT_LABELS[type],
  icon: ELEMENT_ICONS[type],
  onSelect: () => addElement(activeRoot.value.id, type)
}))

function continueEmptyLayout() {
  if (hasData.value) openTemplatePicker()
  else addElement(activeRoot.value.id, 'text')
}

</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col" :class="treeDraggingId ? 'layer-tree-is-dragging' : ''">
    <div class="flex h-11 items-center justify-between border-b border-muted px-3">
      <div class="min-w-0">
        <p class="studio-panel-label text-muted">{{ activeSize }} layout</p>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-layout-template"
          :label="activeRoot.children.length ? 'Change layout' : 'Generate layout'"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="openTemplatePicker"
        />
        <UDropdownMenu :items="addItems" :content="{ align: 'end' }">
          <UButton icon="i-lucide-plus" label="Add" color="neutral" variant="ghost" size="xs" />
        </UDropdownMenu>
      </div>
    </div>

    <div class="flex items-center gap-2 border-b border-muted bg-muted/30 px-3 py-2 text-xs text-muted">
      <UIcon name="i-lucide-move" class="size-3.5 shrink-0" />
      <span>Drag layers here or move them directly on the canvas.</span>
    </div>

    <div class="studio-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
      <EditorTreeNode :element="activeRoot" />
      <div v-if="activeRoot.children.length === 0" class="px-3 py-8 text-center">
        <UIcon :name="hasData ? 'i-lucide-layout-template' : 'i-lucide-type'" class="mx-auto mb-2 size-5 text-dimmed" />
        <p class="text-sm font-medium text-default">{{ hasData ? 'Generate a layout for these values' : 'Start with something visible' }}</p>
        <p class="mx-auto mt-1 max-w-52 text-xs leading-5 text-muted">
          {{ hasData ? 'Compare varied options for this size or build all three sizes together.' : 'Add editable text now. Data can be connected later.' }}
        </p>
        <UButton
          class="mt-3"
          :icon="hasData ? 'i-lucide-wand-sparkles' : 'i-lucide-type'"
          :label="hasData ? 'Generate layout' : 'Add text'"
          color="neutral"
          variant="outline"
          size="xs"
          @click="continueEmptyLayout"
        />
      </div>
    </div>

    <EditorTemplatePicker v-model:open="templatePickerOpen" />
  </section>
</template>
