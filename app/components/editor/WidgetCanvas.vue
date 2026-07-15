<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { colorForPreview } from '~/utils/editor'
import type { PreviewSize, WidgetProperties } from '~/types/editor'

const props = defineProps<{
  size: PreviewSize
  active: boolean
}>()

const emit = defineEmits<{
  toggleVisibility: []
}>()

const {
  document,
  activeSize,
  canvasDraggingId,
  setActiveSize,
  selectElement,
  resolveVariable
} = useWidgetEditor()

const canvasRoot = ref<HTMLElement | null>(null)
const widget = computed(() => document.value.layouts[props.size])
const properties = computed(() => widget.value.properties as WidgetProperties)
const enabled = computed(() => document.value.enabledSizes[props.size])

const sizeDetails: Record<PreviewSize, { label: string, width: number, height: number }> = {
  small: { label: 'Small', width: 158, height: 158 },
  medium: { label: 'Medium', width: 338, height: 158 },
  large: { label: 'Large', width: 338, height: 354 }
}

const details = computed(() => sizeDetails[props.size])

const previewStyle = computed<CSSProperties>(() => ({
  width: `${details.value.width}px`,
  height: `${details.value.height}px`,
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

const backgroundStyle = computed<CSSProperties>(() => ({
  backgroundColor: colorForPreview(properties.value.backgroundColor),
  backgroundImage: backgroundImageUrl.value ? `url(${JSON.stringify(backgroundImageUrl.value)})` : undefined,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  opacity: properties.value.backgroundOpacity ?? 1
}))

useCanvasSortable(canvasRoot, () => widget.value.id)

function activateCanvas() {
  if (activeSize.value !== props.size) setActiveSize(props.size)
}

function selectRoot() {
  activateCanvas()
  selectElement(widget.value.id)
}

function hideCanvas(event: MouseEvent) {
  event.stopPropagation()
  emit('toggleVisibility')
}
</script>

<template>
  <article class="flex w-max flex-col gap-3" :aria-current="active ? 'true' : undefined" :aria-label="`${details.label} widget canvas`">
    <div
      class="flex h-8 items-center justify-between gap-3 transition-[background-color,box-shadow,padding] duration-150"
      :class="active ? 'rounded-md bg-primary/10 px-2 ring-1 ring-primary/30' : 'px-0.5'"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="size-1.5 shrink-0 rounded-full"
          :class="active ? 'bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--ui-primary)_65%,transparent)]' : 'bg-dimmed'"
        />
        <span class="text-xs font-semibold text-default">{{ details.label }}</span>
        <span class="font-mono text-[9px] uppercase tracking-[0.08em] text-dimmed">{{ details.width }} × {{ details.height }} pt</span>
      </div>

      <div class="flex items-center gap-1">
        <UBadge v-if="active" label="Active" color="primary" variant="solid" size="sm" />
        <UBadge
          :label="enabled ? 'Included' : 'Not included'"
          :color="enabled ? 'success' : 'warning'"
          variant="subtle"
          size="sm"
        />
        <UTooltip :text="`Hide ${details.label} from All canvases`">
          <UButton
            icon="i-lucide-eye-off"
            color="neutral"
            variant="ghost"
            size="xs"
            class="hidden sm:inline-flex"
            :aria-label="`Hide ${details.label} canvas`"
            @click="hideCanvas"
          />
        </UTooltip>
      </div>
    </div>

    <div
      class="widget-stage relative overflow-hidden rounded-[22px] transition-[width,height,padding,opacity,filter,box-shadow] duration-200"
      :class="[
        active ? 'ring-2 ring-primary ring-offset-4 ring-offset-[var(--studio-canvas)]' : 'ring-1 ring-default/70 hover:ring-default',
        enabled ? '' : 'opacity-45 grayscale',
        canvasDraggingId && active ? 'canvas-is-dragging' : ''
      ]"
      :style="previewStyle"
      role="button"
      tabindex="0"
      :aria-label="`Edit ${details.label} widget appearance`"
      @pointerdown.capture="activateCanvas"
      @focusin.capture="activateCanvas"
      @click="selectRoot"
      @keydown.enter.prevent="selectRoot"
      @keydown.space.prevent="selectRoot"
    >
      <div class="pointer-events-none absolute inset-0 transition-opacity duration-200" :style="backgroundStyle" aria-hidden="true" />
      <div
        ref="canvasRoot"
        class="relative z-10 flex size-full min-h-0 min-w-0 flex-col"
        data-canvas-drop-list
        :data-canvas-parent-id="widget.id"
      >
        <EditorPreviewNode v-for="child in widget.children" :key="child.id" :element="child" direction="vertical" />
      </div>
    </div>
  </article>
</template>
