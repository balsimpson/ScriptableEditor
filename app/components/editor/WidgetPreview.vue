<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CSSProperties } from 'vue'
import type { PreviewSize, WidgetProperties } from '~/types/editor'
import type { WidgetStarterId } from '~/utils/starters'
import { createWidgetStarterDocument, WIDGET_STARTERS } from '~/utils/starters'

const {
  document,
  activeSize,
  activeRoot,
  selectedElementId,
  canvasDraggingId,
  activeLeftTab,
  setActiveSize,
  setSizeEnabled,
  copyLayout,
  selectElement,
  resolveVariable
} = useWidgetEditor()
const { currentProject, renameProject } = useProjectStore()
const toast = useToast()
const canvasRoot = ref<HTMLElement | null>(null)
const widget = computed(() => activeRoot.value)
const properties = computed(() => widget.value.properties as WidgetProperties)

const sizes: { label: string, value: PreviewSize, icon: string }[] = [
  { label: 'Small', value: 'small', icon: 'i-lucide-square' },
  { label: 'Medium', value: 'medium', icon: 'i-lucide-rectangle-horizontal' },
  { label: 'Large', value: 'large', icon: 'i-lucide-rectangle-vertical' }
]

const dimensions = computed(() => ({
  small: { width: 158, height: 158 },
  medium: { width: 338, height: 158 },
  large: { width: 338, height: 354 }
}[activeSize.value]))

const activeSizeEnabled = computed(() => document.value.enabledSizes[activeSize.value])
const isEmptyProject = computed(() => (
  document.value.data.sampleData === undefined
  && Object.values(document.value.layouts).every(layout => layout.children.length === 0)
))
const copyItems = computed<DropdownMenuItem[]>(() => sizes
  .filter(size => size.value !== activeSize.value)
  .map(size => ({
    label: `Copy from ${size.label}`,
    icon: size.icon,
    onSelect: () => copyLayout(size.value, activeSize.value)
  })))

const previewStyle = computed<CSSProperties>(() => ({
  width: `${dimensions.value.width}px`,
  height: `${dimensions.value.height}px`,
  backgroundColor: properties.value.backgroundColor,
  backgroundImage: backgroundImageUrl.value ? `url(${JSON.stringify(backgroundImageUrl.value)})` : undefined,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  padding: `${properties.value.padding}px`
}))

const backgroundImageUrl = computed(() => {
  if (properties.value.backgroundImageMode === 'static') return properties.value.backgroundImageUrl
  if (properties.value.backgroundImageMode === 'variable') {
    const resolved = resolveVariable(properties.value.backgroundImageVariable)
    return typeof resolved === 'string' && resolved ? resolved : properties.value.backgroundImageFallbackUrl
  }
  return ''
})

useCanvasSortable(canvasRoot, () => widget.value.id)

function updateSizeEnabled(enabled: boolean) {
  if (setSizeEnabled(activeSize.value, enabled)) return
  toast.add({
    title: 'Keep one widget size included',
    description: 'Include another size before removing this layout from the export.',
    color: 'warning',
    icon: 'i-lucide-triangle-alert'
  })
}

function useStarter(id: WidgetStarterId) {
  const starter = WIDGET_STARTERS.find(item => item.id === id)
  if (!starter) return
  const nextDocument = createWidgetStarterDocument(id)
  document.value = nextDocument
  renameProject(currentProject.value.id, starter.projectName)
  selectedElementId.value = nextDocument.layouts.medium.id
  activeLeftTab.value = 'structure'
  toast.add({
    title: id === 'blank' ? 'Blank widget ready' : `${starter.name} ready`,
    description: id === 'blank'
      ? 'Edit the label and value, add layers, or bind fields when you are ready.'
      : 'Its data source, computed values, and three responsive layouts are ready to edit.',
    color: 'success',
    icon: id === 'blank' ? 'i-lucide-shapes' : starter.icon
  })
}
</script>

<template>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="flex h-12 items-center justify-between border-b border-muted bg-[var(--studio-panel)] px-2 sm:px-4">
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--color-teal-400)_65%,transparent)]" />
        <div>
          <p class="text-xs font-medium leading-4 text-default sm:text-sm">Preview</p>
          <p class="studio-panel-label mt-0.5 hidden text-dimmed sm:block">{{ activeSize }} canvas</p>
        </div>
      </div>

      <div class="flex min-w-0 items-center gap-1 sm:gap-2">
        <div class="flex items-center rounded-md bg-muted p-0.5">
          <UTooltip v-for="size in sizes" :key="size.value" :text="`${size.label} layout${document.enabledSizes[size.value] ? ' — included' : ' — not included'}`">
            <div class="relative">
              <UButton
                :icon="size.icon"
                :label="size.label"
                :color="activeSize === size.value ? 'primary' : 'neutral'"
                :variant="activeSize === size.value ? 'soft' : 'ghost'"
                size="xs"
                :aria-label="`${size.label} layout`"
                :ui="{ label: 'hidden sm:inline' }"
                @click="setActiveSize(size.value)"
              />
              <span
                class="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full ring-1 ring-default"
                :class="document.enabledSizes[size.value] ? 'bg-success' : 'bg-dimmed'"
              />
            </div>
          </UTooltip>
        </div>

        <div class="hidden h-5 w-px bg-default lg:block" />
        <label class="hidden items-center gap-2 text-xs text-muted lg:flex">
          Include size
          <USwitch :model-value="activeSizeEnabled" size="sm" @update:model-value="updateSizeEnabled" />
        </label>
        <UDropdownMenu :items="copyItems" :content="{ align: 'end' }">
          <UTooltip text="Replace this layout from another size">
            <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" aria-label="Copy another size layout" />
          </UTooltip>
        </UDropdownMenu>
      </div>
    </div>

    <div v-if="isEmptyProject" class="studio-workbench studio-scrollbar flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--studio-canvas)] p-3 sm:p-8">
      <div class="workbench-ruler workbench-ruler-x hidden sm:block" aria-hidden="true" />
      <div class="workbench-ruler workbench-ruler-y hidden sm:block" aria-hidden="true" />
      <span class="workbench-ruler-label hidden sm:block" aria-hidden="true">Start / source</span>

      <div class="relative z-10 w-full max-w-2xl overflow-hidden border-y border-default bg-default/95 shadow-[0_24px_80px_var(--studio-shadow)] backdrop-blur-sm">
        <div class="border-b border-muted px-4 py-4 sm:px-6 sm:py-5">
          <div class="flex items-start gap-3 sm:gap-4">
            <span class="studio-mark studio-mark-lg">
              <UIcon name="i-lucide-crosshair" class="size-5" />
            </span>
            <div>
              <p class="studio-panel-label mb-1 text-primary">New instrument</p>
              <p class="text-lg font-semibold tracking-tight text-highlighted">What do you want to keep an eye on?</p>
              <p class="mt-1 text-sm leading-6 text-muted">Start from a working widget, or connect any JSON, Shortcut, or built-in value.</p>
            </div>
          </div>
        </div>

        <div class="divide-y divide-muted">
          <button
            v-for="starter in WIDGET_STARTERS"
            :key="starter.id"
            type="button"
            class="group flex w-full items-center gap-3 border-l-2 border-l-transparent px-4 py-3 text-left outline-none transition-colors hover:border-l-primary hover:bg-elevated focus-visible:border-l-primary focus-visible:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4 sm:px-6 sm:py-4"
            @click="useStarter(starter.id)"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105" :class="starter.accentClass">
              <UIcon :name="starter.icon" class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold text-highlighted">{{ starter.name }}</span>
                <UBadge :label="starter.sourceLabel" color="neutral" variant="subtle" size="sm" />
              </span>
              <span class="mt-0.5 block text-xs leading-5 text-muted">{{ starter.description }}</span>
            </span>
            <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5 group-hover:text-default" />
          </button>
        </div>
      </div>
    </div>

    <div v-else class="studio-workbench studio-scrollbar flex min-h-0 flex-1 items-center justify-start overflow-auto bg-[var(--studio-canvas)] p-3 sm:justify-center sm:p-6 lg:p-10">
      <div class="workbench-ruler workbench-ruler-x hidden sm:block" aria-hidden="true" />
      <div class="workbench-ruler workbench-ruler-y hidden sm:block" aria-hidden="true" />
      <span class="workbench-ruler-label hidden sm:block" aria-hidden="true">{{ activeSize }} / {{ dimensions.width }} × {{ dimensions.height }} pt</span>

      <div class="relative z-10 mx-auto flex min-w-max flex-col items-center gap-3 sm:gap-5">
        <div
          class="widget-stage overflow-hidden rounded-[22px] transition-[width,height,background-color,padding,opacity,filter] duration-200"
          :class="[
            selectedElementId === widget.id ? 'ring-2 ring-primary ring-offset-4 ring-offset-[var(--studio-canvas)]' : '',
            activeSizeEnabled ? '' : 'opacity-45 grayscale',
            canvasDraggingId ? 'canvas-is-dragging' : ''
          ]"
          :style="previewStyle"
          @click="selectElement(widget.id)"
        >
          <div
            ref="canvasRoot"
            class="flex size-full min-h-0 min-w-0 flex-col"
            data-canvas-drop-list
            :data-canvas-parent-id="widget.id"
          >
            <EditorPreviewNode v-for="child in widget.children" :key="child.id" :element="child" direction="vertical" />
          </div>
        </div>

        <div class="flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-[5px] border border-default bg-[var(--studio-panel)]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.06em] shadow-sm backdrop-blur sm:max-w-none sm:text-[10px] sm:tracking-[0.08em]" :class="activeSizeEnabled ? 'text-muted' : 'text-warning'">
          <UIcon :name="canvasDraggingId ? 'i-lucide-move' : 'i-lucide-monitor-smartphone'" class="size-3.5" />
          <span v-if="canvasDraggingId">Drop to place {{ selectedElementId === widget.id ? 'the element' : 'the selected element' }}</span>
          <span v-else-if="activeSizeEnabled" class="sm:hidden">{{ dimensions.width }} × {{ dimensions.height }} pt · Included</span>
          <span v-else-if="activeSizeEnabled" class="hidden sm:inline">{{ dimensions.width }} × {{ dimensions.height }} pt · Drag elements to arrange · Included in export</span>
          <span v-else>{{ sizes.find(size => size.value === activeSize)?.label }} layout is not included in the export</span>
        </div>
      </div>
    </div>
  </section>
</template>
