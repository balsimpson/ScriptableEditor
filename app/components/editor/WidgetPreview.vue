<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PreviewSize } from '~/types/editor'
import type { WidgetStarterId } from '~/utils/starters'
import { createWidgetStarterDocument, WIDGET_STARTERS } from '~/utils/starters'

const {
  document,
  activeSize,
  selectedElementId,
  canvasDraggingId,
  activeLeftTab,
  setActiveSize,
  setSizeEnabled,
  copyLayout,
} = useWidgetEditor()
const { currentProject, renameProject } = useProjectStore()
const toast = useToast()

type PreviewMode = 'all' | PreviewSize

const previewMode = ref<PreviewMode>('all')
const visibleSizes = reactive<Record<PreviewSize, boolean>>({
  small: true,
  medium: true,
  large: true
})

const sizes: { label: string, value: PreviewSize, icon: string }[] = [
  { label: 'Small', value: 'small', icon: 'i-lucide-square' },
  { label: 'Medium', value: 'medium', icon: 'i-lucide-rectangle-horizontal' },
  { label: 'Large', value: 'large', icon: 'i-lucide-rectangle-vertical' }
]

const activeSizeEnabled = computed(() => document.value.enabledSizes[activeSize.value])
const visibleSizeCount = computed(() => Object.values(visibleSizes).filter(Boolean).length)
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
const visibilityItems = computed<DropdownMenuItem[]>(() => sizes.map(size => ({
  label: size.label,
  icon: visibleSizes[size.value] ? 'i-lucide-eye' : 'i-lucide-eye-off',
  onSelect: () => toggleCanvasVisibility(size.value)
})))

watch(activeSize, (size) => {
  if (previewMode.value !== 'all') previewMode.value = size
})

function setPreviewMode(mode: PreviewMode) {
  previewMode.value = mode
  if (mode !== 'all') setActiveSize(mode)
}

function toggleCanvasVisibility(size: PreviewSize) {
  if (visibleSizes[size] && visibleSizeCount.value === 1) {
    toast.add({
      title: 'Keep one canvas visible',
      description: 'Show another size before hiding this canvas.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
    return
  }

  visibleSizes[size] = !visibleSizes[size]
  if (!visibleSizes[size] && previewMode.value === 'all' && activeSize.value === size) {
    const nextSize = sizes.find(item => visibleSizes[item.value])?.value
    if (nextSize) setActiveSize(nextSize)
  }
}

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
  <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div class="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-muted bg-[var(--studio-panel)] px-2 py-1.5 sm:px-4">
      <div class="flex shrink-0 items-center gap-2">
        <span class="size-1.5 rounded-full bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--color-teal-400)_65%,transparent)]" />
        <div>
          <p class="text-xs font-medium leading-4 text-default sm:text-sm">Preview</p>
          <p class="studio-panel-label mt-0.5 hidden text-dimmed sm:block">{{ previewMode === 'all' ? `${visibleSizeCount} canvases` : `${activeSize} canvas` }}</p>
        </div>
      </div>

      <div class="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
        <div class="hidden max-w-full flex-wrap items-center justify-end rounded-md bg-muted p-0.5 sm:flex">
          <UButton
            icon="i-lucide-layout-grid"
            label="All"
            :color="previewMode === 'all' ? 'primary' : 'neutral'"
            :variant="previewMode === 'all' ? 'soft' : 'ghost'"
            size="xs"
            @click="setPreviewMode('all')"
          />
          <UTooltip v-for="size in sizes" :key="size.value" :text="`${size.label} layout${document.enabledSizes[size.value] ? ' — included' : ' — not included'}`">
            <div class="relative">
              <UButton
                :icon="size.icon"
                :label="size.label"
                :color="previewMode === size.value ? 'primary' : 'neutral'"
                :variant="previewMode === size.value ? 'soft' : 'ghost'"
                size="xs"
                :aria-label="`${size.label} layout`"
                @click="setPreviewMode(size.value)"
              />
              <span
                class="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full ring-1 ring-default"
                :class="document.enabledSizes[size.value] ? 'bg-success' : 'bg-dimmed'"
              />
            </div>
          </UTooltip>
        </div>

        <div class="flex items-center rounded-md bg-muted p-0.5 sm:hidden">
          <UTooltip v-for="size in sizes" :key="size.value" :text="`${size.label} layout`">
            <UButton
              :icon="size.icon"
              :color="activeSize === size.value ? 'primary' : 'neutral'"
              :variant="activeSize === size.value ? 'soft' : 'ghost'"
              size="xs"
              class="min-h-11 min-w-11 justify-center"
              :aria-label="`${size.label} layout`"
              @click="setPreviewMode(size.value)"
            />
          </UTooltip>
        </div>

        <div class="hidden h-5 w-px bg-default lg:block" />
        <label class="hidden items-center gap-2 text-xs text-muted lg:flex">
          Include size
          <USwitch :model-value="activeSizeEnabled" size="sm" @update:model-value="updateSizeEnabled" />
        </label>
        <UDropdownMenu :items="visibilityItems" :content="{ align: 'end' }">
          <UTooltip text="Choose canvases shown in All">
            <UButton
              icon="i-lucide-eye"
              :label="`${visibleSizeCount}/3`"
              color="neutral"
              variant="ghost"
              size="xs"
              class="hidden sm:inline-flex"
              aria-label="Canvas visibility"
            />
          </UTooltip>
        </UDropdownMenu>
        <UDropdownMenu :items="copyItems" :content="{ align: 'end' }">
          <UTooltip text="Replace this layout from another size">
            <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" class="min-h-11 min-w-11 justify-center sm:min-h-0 sm:min-w-0" aria-label="Copy another size layout" />
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
              <p class="studio-panel-label mb-1 text-primary">New widget</p>
              <p class="text-lg font-semibold tracking-tight text-highlighted">What do you want to build?</p>
              <p class="mt-1 text-sm leading-6 text-muted">Start with a working example or a blank canvas. Build the layout first, then connect JSON, Shortcuts, or built-in values when you need them.</p>
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

    <div
      v-else
      class="studio-workbench studio-scrollbar flex min-h-0 flex-1 justify-start overflow-auto bg-[var(--studio-canvas)] p-3 sm:justify-center sm:p-6 lg:p-10"
      :class="previewMode === 'all' ? 'items-start' : 'items-center'"
    >
      <div class="workbench-ruler workbench-ruler-x hidden sm:block" aria-hidden="true" />
      <div class="workbench-ruler workbench-ruler-y hidden sm:block" aria-hidden="true" />
      <span class="workbench-ruler-label hidden sm:block" aria-hidden="true">{{ previewMode === 'all' ? 'All layouts / true size' : `${activeSize} layout / focus` }}</span>

      <div class="relative z-10 mx-auto flex min-w-max flex-col items-center gap-5 sm:gap-7">
        <template v-if="previewMode === 'all'">
          <div class="flex w-[338px] flex-col items-start gap-5 sm:gap-7">
            <template v-for="size in sizes" :key="size.value">
              <EditorWidgetCanvas
                v-if="visibleSizes[size.value]"
                :size="size.value"
                :active="activeSize === size.value"
                @toggle-visibility="toggleCanvasVisibility(size.value)"
              />
              <div v-else class="flex w-full items-center justify-between gap-3 border-y border-dashed border-default bg-[var(--studio-panel)]/55 px-3 py-2">
                <div class="flex min-w-0 items-center gap-2 text-muted">
                  <UIcon name="i-lucide-eye-off" class="size-3.5 shrink-0" />
                  <span class="text-xs font-medium">{{ size.label }} preview hidden</span>
                </div>
                <UButton
                  icon="i-lucide-eye"
                  label="Show"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  :aria-label="`Show ${size.label} preview`"
                  @click="toggleCanvasVisibility(size.value)"
                />
              </div>
            </template>
          </div>
        </template>

        <EditorWidgetCanvas v-else :size="previewMode" active />

        <div class="flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-[5px] border border-default bg-[var(--studio-panel)]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.06em] shadow-sm backdrop-blur sm:max-w-none sm:text-[10px] sm:tracking-[0.08em]" :class="activeSizeEnabled ? 'text-muted' : 'text-warning'">
          <UIcon :name="canvasDraggingId ? 'i-lucide-move' : 'i-lucide-monitor-smartphone'" class="size-3.5" />
          <span v-if="canvasDraggingId">Drop to place the selected element</span>
          <span v-else-if="activeSizeEnabled" class="sm:hidden">{{ activeSize }} · Included</span>
          <span v-else-if="activeSizeEnabled" class="hidden sm:inline">{{ activeSize }} canvas active · Drag elements to arrange · Included in export</span>
          <span v-else>{{ sizes.find(size => size.value === activeSize)?.label }} layout is not included in the export</span>
        </div>
      </div>
    </div>
  </section>
</template>
