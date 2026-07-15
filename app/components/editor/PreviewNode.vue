<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import type { DateProperties, ImageProperties, SpacerProperties, StackProperties, TextProperties, WidgetElement } from '~/types/editor'
import { colorForPreview, formatDatePattern, formatPreviewValue } from '~/utils/editor'

defineOptions({ name: 'EditorPreviewNode' })

const props = withDefaults(defineProps<{
  element: WidgetElement
  direction?: 'vertical' | 'horizontal'
  repeatIndex?: number
}>(), {
  direction: 'vertical'
})
const { selectedElementId, canvasStackHandleId, selectElement, resolveVariable } = useWidgetEditor()
const stackElement = ref<HTMLElement | null>(null)

const isSelected = computed(() => selectedElementId.value === props.element.id)
const stackDirection = computed(() => props.element.type === 'horizontalStack' ? 'horizontal' : 'vertical')
const repeatCount = computed(() => {
  if (props.element.type !== 'verticalStack' && props.element.type !== 'horizontalStack') return 1
  return Math.max(1, Math.min(12, Math.round((props.element.properties as StackProperties).repeatCount || 1)))
})

useCanvasSortable(stackElement, () => props.element.id, stackDirection)

const stackStyle = computed<CSSProperties>(() => {
  const value = props.element.properties as StackProperties
  const vertical = props.element.type === 'verticalStack'
  const hasFlexibleSpacer = props.element.children.some((child) => {
    if (child.type !== 'spacer') return false
    return (child.properties as SpacerProperties).mode === 'flexible'
  })
  const alignMap = { leading: 'flex-start', center: 'center', trailing: 'flex-end' } as const
  const alphaColor = colorForPreview(value.backgroundColor || 'transparent')
  return {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    alignItems: vertical ? alignMap[value.alignment] : 'center',
    justifyContent: vertical ? 'flex-start' : alignMap[value.alignment],
    gap: `${value.spacing}px`,
    padding: `${value.padding}px`,
    backgroundColor: alphaColor,
    borderRadius: `${value.cornerRadius}px`,
    border: value.borderWidth ? `${value.borderWidth}px solid ${colorForPreview(value.borderColor)}` : undefined,
    position: 'relative',
    width: !vertical && hasFlexibleSpacer ? '100%' : undefined,
    height: vertical && hasFlexibleSpacer ? '100%' : undefined,
    flex: vertical && hasFlexibleSpacer ? '1 1 auto' : undefined,
    minWidth: 0,
    minHeight: 0
  }
})

const spacerStyle = computed<CSSProperties>(() => {
  const value = props.element.properties as SpacerProperties
  if (value.mode === 'flexible') {
    return {
      flex: '1 1 0px',
      alignSelf: 'stretch',
      minWidth: props.direction === 'horizontal' ? '2px' : 0,
      minHeight: props.direction === 'vertical' ? '2px' : 0
    }
  }

  return props.direction === 'horizontal'
    ? { width: `${value.size}px`, flex: `0 0 ${value.size}px`, alignSelf: 'stretch', minHeight: '2px' }
    : { height: `${value.size}px`, flex: `0 0 ${value.size}px`, alignSelf: 'stretch', minWidth: '2px' }
})

const textStyle = computed<CSSProperties>(() => {
  const value = props.element.properties as TextProperties
  const fontMap = {
    system: 'var(--font-sans)',
    rounded: 'ui-rounded, "Avenir Next Rounded", var(--font-sans)',
    serif: 'ui-serif, Georgia, serif',
    monospaced: 'var(--font-mono)'
  }
  const weightMap = { ultralight: 100, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 }
  return {
    color: colorForPreview(value.color),
    fontFamily: fontMap[value.font],
    fontSize: `${value.fontSize}px`,
    fontWeight: weightMap[value.weight],
    opacity: value.opacity,
    textAlign: value.alignment === 'leading' ? 'left' : value.alignment === 'trailing' ? 'right' : 'center',
    WebkitLineClamp: value.lineLimit,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: 1.2,
    maxWidth: '100%',
    flexShrink: 0
  }
})

const textContent = computed(() => {
  const value = props.element.properties as TextProperties
  if (value.contentMode === 'static') return value.content
  if (!value.variable) return '—'
  return formatPreviewValue(resolveVariable(value.variable, props.repeatIndex), value.format)
})

const imageStyle = computed<CSSProperties>(() => {
  const value = props.element.properties as ImageProperties
  return {
    width: `${value.width}px`,
    height: `${value.height}px`,
    borderRadius: `${value.cornerRadius}px`,
    opacity: value.opacity,
    objectFit: value.contentMode === 'fill' ? 'cover' : 'contain',
    color: colorForPreview(value.tintColor),
    flex: '0 0 auto'
  }
})

const imageUrl = computed(() => {
  const value = props.element.properties as ImageProperties
  if (value.sourceType !== 'remote') return ''
  if (value.remoteMode === 'static') return value.remoteUrl
  const resolved = resolveVariable(value.variable, props.repeatIndex)
  return typeof resolved === 'string' && resolved ? resolved : value.fallbackUrl
})

const symbolIcon = computed(() => {
  const symbol = (props.element.properties as ImageProperties).systemSymbol.toLowerCase()
  if (symbol.includes('sun')) return 'i-lucide-sun'
  if (symbol.includes('cloud') && symbol.includes('rain')) return 'i-lucide-cloud-rain'
  if (symbol.includes('cloud')) return 'i-lucide-cloud'
  if (symbol.includes('moon')) return 'i-lucide-moon'
  if (symbol.includes('snow')) return 'i-lucide-snowflake'
  if (symbol.includes('thermometer')) return 'i-lucide-thermometer'
  if (symbol.includes('bitcoin')) return 'i-lucide-bitcoin'
  if (symbol.includes('timer')) return 'i-lucide-timer'
  if (symbol.includes('calendar')) return 'i-lucide-calendar'
  if (symbol.includes('wallet')) return 'i-lucide-wallet-cards'
  if (symbol.includes('gauge')) return 'i-lucide-gauge'
  if (symbol.includes('chart.bar')) return 'i-lucide-chart-column'
  if (symbol.includes('chart')) return 'i-lucide-chart-no-axes-combined'
  if (symbol.includes('battery')) return 'i-lucide-battery-medium'
  return 'i-lucide-image'
})

const dateText = computed(() => {
  const value = props.element.properties as DateProperties
  const resolved = value.sourceType === 'variable' ? resolveVariable(value.variable, props.repeatIndex) : new Date()
  const date = resolved instanceof Date ? resolved : new Date(resolved as string | number)
  if (Number.isNaN(date.getTime())) return value.fallback || '—'
  if (value.relativeDate) {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000)
    const absolute = Math.abs(seconds)
    if (absolute < 60) return 'now'
    if (absolute < 3600) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / 60), 'minute')
    if (absolute < 86400) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / 3600), 'hour')
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / 86400), 'day')
  }
  return formatDatePattern(date, value.dateFormat)
})

const dateStyle = computed<CSSProperties>(() => {
  const value = props.element.properties as DateProperties
  const weightMap = { ultralight: 100, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 }
  return {
    color: colorForPreview(value.color),
    fontSize: `${value.fontSize}px`,
    fontWeight: weightMap[value.weight],
    fontFamily: value.font === 'monospaced' ? 'var(--font-mono)' : value.font === 'serif' ? 'Georgia, serif' : 'var(--font-sans)',
    flexShrink: 0
  }
})

function select(event: Event) {
  event.stopPropagation()
  selectElement(props.element.id)
}

function activateStackHandle() {
  canvasStackHandleId.value = props.element.id
  selectElement(props.element.id)
}

function releaseStackHandle() {
  if (canvasStackHandleId.value === props.element.id) canvasStackHandleId.value = ''
}

function setStackElement(value: Element | ComponentPublicInstance | null, instanceIndex: number) {
  if (instanceIndex === 0) stackElement.value = value instanceof HTMLElement ? value : null
}
</script>

<template>
  <template v-if="element.type === 'verticalStack' || element.type === 'horizontalStack'">
    <div
      v-for="instanceIndex in repeatCount"
      :key="`${element.id}-${instanceIndex}`"
      :ref="value => setStackElement(value, instanceIndex - 1)"
      :style="stackStyle"
      class="canvas-stack-node"
      :class="isSelected ? 'canvas-node-selected' : ''"
      :data-canvas-sortable-item="instanceIndex === 1 ? '' : undefined"
      :data-canvas-drag-handle="instanceIndex === 1 ? '' : undefined"
      :data-canvas-drop-list="instanceIndex === 1 ? '' : undefined"
      :data-canvas-element-id="instanceIndex === 1 ? element.id : undefined"
      :data-canvas-parent-id="instanceIndex === 1 ? element.id : undefined"
      @click="select"
    >
      <button
        v-if="instanceIndex === 1"
        type="button"
        class="canvas-stack-drag-handle grid place-items-center rounded-[4px] border border-default bg-elevated text-muted shadow-sm outline-none hover:text-default focus-visible:ring-2 focus-visible:ring-primary"
        :class="isSelected ? 'canvas-stack-drag-handle-visible' : ''"
        :aria-label="`Move ${element.name}`"
        data-canvas-drag-handle
        @pointerenter="activateStackHandle"
        @pointerleave="releaseStackHandle"
        @pointerdown="activateStackHandle"
        @focus="activateStackHandle"
        @blur="releaseStackHandle"
        @click.stop
      >
        <UIcon name="i-lucide-grip" class="size-3" />
      </button>
      <EditorPreviewNode
        v-for="child in element.children"
        :key="`${child.id}-${instanceIndex}`"
        :element="child"
        :direction="element.type === 'verticalStack' ? 'vertical' : 'horizontal'"
        :repeat-index="repeatCount > 1 ? instanceIndex - 1 : repeatIndex"
      />
    </div>
  </template>

  <span
    v-else-if="element.type === 'text'"
    :style="textStyle"
    :class="isSelected ? 'canvas-node-selected rounded-sm' : ''"
    data-canvas-sortable-item
    data-canvas-drag-handle
    :data-canvas-element-id="element.id"
    role="button"
    tabindex="0"
    :aria-label="`Edit ${element.name}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  >{{ textContent }}</span>

  <span
    v-else-if="element.type === 'spacer'"
    class="block shrink-0"
    :class="isSelected ? 'bg-primary/20 ring-1 ring-primary' : ''"
    :style="spacerStyle"
    data-canvas-sortable-item
    data-canvas-drag-handle
    :data-canvas-element-id="element.id"
    role="button"
    tabindex="0"
    :aria-label="`Edit ${(element.properties as SpacerProperties).mode === 'flexible' ? 'flexible spacer' : `${(element.properties as SpacerProperties).size} point spacer`}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  />

  <img
    v-else-if="element.type === 'image' && (element.properties as ImageProperties).sourceType === 'remote' && imageUrl"
    :src="imageUrl"
    :alt="element.name"
    :style="imageStyle"
    :class="isSelected ? 'canvas-node-selected' : ''"
    :draggable="false"
    data-canvas-sortable-item
    data-canvas-drag-handle
    :data-canvas-element-id="element.id"
    role="button"
    tabindex="0"
    :aria-label="`Edit ${element.name}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  >

  <span
    v-else-if="element.type === 'image'"
    class="grid shrink-0 place-items-center"
    :style="imageStyle"
    :class="isSelected ? 'canvas-node-selected' : ''"
    data-canvas-sortable-item
    data-canvas-drag-handle
    :data-canvas-element-id="element.id"
    role="button"
    tabindex="0"
    :aria-label="`Edit ${element.name}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  >
    <UIcon :name="symbolIcon" class="size-full" />
  </span>

  <time
    v-else-if="element.type === 'date'"
    :style="dateStyle"
    :class="isSelected ? 'canvas-node-selected rounded-sm' : ''"
    data-canvas-sortable-item
    data-canvas-drag-handle
    :data-canvas-element-id="element.id"
    role="button"
    tabindex="0"
    :aria-label="`Edit ${element.name}`"
    @click="select"
    @keydown.enter.prevent="select"
    @keydown.space.prevent="select"
  >{{ dateText }}</time>
</template>
