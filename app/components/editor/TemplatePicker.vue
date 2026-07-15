<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { EditorDocument, PreviewSize, WidgetProperties } from '~/types/editor'
import type { TemplateContentOptions, WidgetTemplate } from '~/utils/templates'
import {
  applyAdaptiveTemplateSet,
  applyWidgetTemplate,
  buildWidgetTemplate,
  detectTemplateDomain,
  generateWidgetTemplateOptions,
  getTemplateVariables,
  isCountdownDocument,
  TEMPLATE_DENSITY_LABELS,
  TEMPLATE_DOMAIN_LABELS
} from '~/utils/templates'

const open = defineModel<boolean>('open', { default: false })
const { document, selectedElementId, activeLeftTab, resolveVariable } = useWidgetEditor()
const toast = useToast()
const targetSize = ref<PreviewSize>(document.value.activeSize)
const generation = ref(0)
const selectedTemplateId = ref('')
const showCountdownLabel = ref(true)
const showCountdownImage = ref(true)
const countdownImageUrl = ref('')

const sizes: { label: string, value: PreviewSize, icon: string }[] = [
  { label: 'Small', value: 'small', icon: 'i-lucide-square' },
  { label: 'Medium', value: 'medium', icon: 'i-lucide-rectangle-horizontal' },
  { label: 'Large', value: 'large', icon: 'i-lucide-rectangle-vertical' }
]

const variables = computed(() => getTemplateVariables(document.value))
const domain = computed(() => detectTemplateDomain(document.value))
const isCountdown = computed(() => variables.value.length > 0 && isCountdownDocument(document.value))
const countdownLabel = computed(() => variables.value.find((variable) => {
  if (variable.kind !== 'text') return false
  const path = variable.path.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').toLowerCase()
  return /(event title|countdown label|title|event name|label|name)/.test(path) && !/(date|time)/.test(path)
}))
const detectedImage = computed(() => variables.value.find(variable => variable.kind === 'image'))
const imageUrlError = computed(() => {
  const value = countdownImageUrl.value.trim()
  return value && !/^https?:\/\//i.test(value) ? 'Enter a complete HTTP or HTTPS image URL.' : ''
})
const contentOptions = computed<TemplateContentOptions>(() => ({
  showLabel: showCountdownLabel.value,
  showImage: showCountdownImage.value,
  imageUrl: imageUrlError.value ? '' : countdownImageUrl.value.trim()
}))
const templateOptions = computed(() => variables.value.length
  ? generateWidgetTemplateOptions(document.value, targetSize.value, generation.value)
  : [])
const previews = computed(() => templateOptions.value.map(template => ({
  template,
  built: buildWidgetTemplate(template, document.value, contentOptions.value)
})))
const selectedPreview = computed(() => previews.value.find(item => item.template.id === selectedTemplateId.value))
const variableLabels = computed(() => new Map(variables.value.map(variable => [variable.path, variable.label])))
const hasExistingLayouts = computed(() => Object.values(document.value.layouts).some(layout => layout.children.length > 0))

const dimensions: Record<PreviewSize, { width: number, height: number }> = {
  small: { width: 158, height: 158 },
  medium: { width: 338, height: 158 },
  large: { width: 338, height: 354 }
}

watch(templateOptions, (options) => {
  selectedTemplateId.value = options[0]?.id || ''
}, { immediate: true })

watch(open, (value) => {
  if (!value) return
  targetSize.value = document.value.activeSize
  generation.value = 0
  showCountdownLabel.value = true
  showCountdownImage.value = true
  countdownImageUrl.value = ''
})

function previewStyle(template: WidgetTemplate, root: EditorDocument['layouts'][PreviewSize]): CSSProperties {
  const size = dimensions[template.size]
  const properties = root.properties as WidgetProperties
  const scale = Math.min(480 / size.width, 300 / size.height, 1.45)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
    padding: `${properties.padding}px`,
    transform: `translate(-50%, -50%) scale(${scale})`
  }
}

function previewBackgroundStyle(root: EditorDocument['layouts'][PreviewSize]): CSSProperties {
  const properties = root.properties as WidgetProperties
  const imageUrl = properties.backgroundImageMode === 'static'
    ? properties.backgroundImageUrl
    : properties.backgroundImageMode === 'variable'
      ? String(resolveVariable(properties.backgroundImageVariable) || properties.backgroundImageFallbackUrl || '')
      : ''
  return {
    backgroundColor: properties.backgroundColor,
    backgroundImage: imageUrl ? `url(${JSON.stringify(imageUrl)})` : undefined,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    opacity: properties.backgroundOpacity
  }
}

function snapshotDocument() {
  return JSON.parse(JSON.stringify(document.value)) as EditorDocument
}

function undoAction(previous: EditorDocument) {
  return {
    label: 'Undo',
    onClick: () => {
      document.value = previous
      selectedElementId.value = previous.layouts[previous.activeSize].id
    }
  }
}

function selectSize(size: PreviewSize) {
  targetSize.value = size
  generation.value = 0
}

function rollDesigns() {
  generation.value = Date.now() + Math.floor(Math.random() * 100_000)
}

function applyAllSizes() {
  if (!variables.value.length || !selectedPreview.value) return
  const replacing = hasExistingLayouts.value
  const previous = snapshotDocument()
  const result = applyAdaptiveTemplateSet(
    document.value,
    generation.value,
    contentOptions.value,
    selectedPreview.value.template
  )
  selectedElementId.value = result.layouts.medium.id
  open.value = false
  toast.add({
    title: replacing ? 'All size layouts replaced' : 'Three data-aware layouts created',
    description: isCountdown.value
      ? `The ${TEMPLATE_DENSITY_LABELS[selectedPreview.value.template.density].toLowerCase()} countdown style now adapts across all three sizes.`
      : `The same ${TEMPLATE_DENSITY_LABELS[selectedPreview.value.template.density].toLowerCase()} design system now adapts across all three sizes.`,
    color: 'success',
    icon: 'i-lucide-panels-top-left',
    actions: [undoAction(previous)]
  })
}

function applySelectedSize() {
  const selected = templateOptions.value.find(template => template.id === selectedTemplateId.value)
  if (!selected || !variables.value.length) return
  const previous = snapshotDocument()
  const built = applyWidgetTemplate(selected, document.value, contentOptions.value)
  selectedElementId.value = built.root.id
  open.value = false
  toast.add({
    title: `${selected.name} applied to ${selected.size}`,
    description: 'Other size layouts were left unchanged.',
    color: 'success',
    icon: 'i-lucide-wand-sparkles',
    actions: [undoAction(previous)]
  })
}

function openJson() {
  open.value = false
  activeLeftTab.value = 'json'
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Choose a layout"
    :description="`Pick a starting point for the ${targetSize} widget. Your data is already connected.`"
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-4xl', body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <div v-if="variables.length">
        <div class="flex flex-col gap-3 border-b border-muted bg-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex items-center gap-1 rounded-md bg-muted p-0.5" aria-label="Widget size">
              <UButton
                v-for="size in sizes"
                :key="size.value"
                :icon="size.icon"
                :label="size.label"
                color="neutral"
                :variant="targetSize === size.value ? 'solid' : 'ghost'"
                size="sm"
                @click="selectSize(size.value)"
              />
            </div>
            <UBadge :label="TEMPLATE_DOMAIN_LABELS[domain]" color="neutral" variant="subtle" size="sm" />
          </div>
          <UButton
            icon="i-lucide-panels-top-left"
            :label="hasExistingLayouts ? 'Redesign all sizes' : 'Create all sizes'"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="Boolean(imageUrlError)"
            @click="applyAllSizes"
          />
        </div>

        <div v-if="isCountdown" class="space-y-3 border-b border-muted px-5 py-3 sm:px-6">
          <div class="flex items-center justify-between gap-4">
            <p class="text-sm font-medium text-default">Event label</p>
            <USwitch v-model="showCountdownLabel" :disabled="!countdownLabel" aria-label="Show event label" />
          </div>

          <div class="grid gap-2">
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-medium text-default">Use image</p>
              <USwitch v-model="showCountdownImage" aria-label="Use image" />
            </div>
            <UInput
              v-model="countdownImageUrl"
              type="url"
              icon="i-lucide-image"
              placeholder="Image URL"
              aria-label="Image URL"
              class="w-full"
              :disabled="!showCountdownImage"
            />
          </div>
          <p v-if="imageUrlError" class="text-xs text-error">{{ imageUrlError }}</p>
        </div>

        <div class="grid h-[min(68vh,42rem)] min-h-0 grid-rows-[auto_minmax(10rem,1fr)] overflow-hidden lg:h-[min(62vh,30rem)] lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)] lg:grid-rows-1">
          <div class="min-w-0 p-4 sm:p-6">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-semibold text-highlighted">{{ selectedPreview?.template.name }}</p>
                  <UBadge v-if="selectedPreview" :label="selectedPreview.template.layout" color="neutral" variant="subtle" size="sm" />
                  <UBadge
                    v-if="selectedPreview"
                    :label="TEMPLATE_DENSITY_LABELS[selectedPreview.template.density]"
                    :color="selectedPreview.template.density === 'dense' ? 'primary' : 'neutral'"
                    variant="soft"
                    size="sm"
                  />
                </div>
              </div>
              <UBadge v-if="selectedTemplateId === templateOptions[0]?.id" label="Recommended" color="primary" variant="soft" size="sm" />
            </div>

            <div class="studio-grid relative h-44 overflow-hidden rounded-lg border border-muted sm:h-64 lg:h-[20rem]">
              <div
                v-if="selectedPreview"
                class="pointer-events-none absolute left-1/2 top-1/2 overflow-hidden rounded-[22px] shadow-[0_24px_64px_rgba(15,23,42,0.3)]"
                :style="previewStyle(selectedPreview.template, selectedPreview.built.root)"
              >
                <div class="pointer-events-none absolute inset-0" :style="previewBackgroundStyle(selectedPreview.built.root)" aria-hidden="true" />
                <div class="relative z-10 flex size-full min-h-0 min-w-0 flex-col">
                  <EditorPreviewNode v-for="child in selectedPreview.built.root.children" :key="child.id" :element="child" direction="vertical" />
                </div>
              </div>
            </div>

            <p v-if="selectedPreview" class="mt-3 text-xs text-muted">
              Data: {{ selectedPreview.built.usedPaths.map(path => variableLabels.get(path) || path).join(' · ') }}
            </p>
          </div>

          <div class="flex min-h-0 flex-col border-t border-muted bg-elevated/40 p-3 lg:border-l lg:border-t-0">
            <div class="shrink-0 rounded-md border border-primary/25 bg-primary/5 px-3 py-3">
              <div class="flex items-start gap-2.5">
                <span class="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <UIcon name="i-lucide-dices" class="size-4" />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-highlighted">Explore another direction</p>
                  <p class="mt-0.5 text-xs leading-5 text-muted">Roll a fresh set without changing your widget.</p>
                </div>
              </div>
              <UButton
                class="mt-3"
                icon="i-lucide-dices"
                :label="`Roll ${previews.length} new designs`"
                color="primary"
                variant="soft"
                size="sm"
                block
                @click="rollDesigns"
              />
            </div>

            <div class="flex shrink-0 items-center justify-between gap-3 px-2 pb-2 pt-4">
              <div>
                <p class="text-sm font-semibold text-highlighted">{{ previews.length }} design options</p>
                <p class="mt-0.5 text-xs text-muted">Select one to preview it at full size.</p>
              </div>
            </div>

            <div class="studio-scrollbar mt-1 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]" role="listbox" :aria-label="`${targetSize} layout styles`">
              <button
                v-for="item in previews"
                :key="item.template.id"
                type="button"
                role="option"
                class="group flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary"
                :class="selectedTemplateId === item.template.id ? 'border-primary bg-primary/10' : 'border-transparent'"
                :aria-selected="selectedTemplateId === item.template.id"
                @click="selectedTemplateId = item.template.id"
              >
                <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-default shadow-sm" :style="{ color: item.template.accent }">
                  <UIcon :name="item.template.icon" class="size-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-highlighted">{{ item.template.name }}</span>
                  </span>
                  <span class="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-toned">
                    <span>{{ TEMPLATE_DENSITY_LABELS[item.template.density] }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ isCountdown ? (item.template.countdownTreatment === 'single-line' ? 'One-line timer' : 'Hero timer') : `${item.built.usedPaths.length} ${item.built.usedPaths.length === 1 ? 'value' : 'values'}` }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ isCountdown && detectedImage && item.template.imageTreatment === 'background' ? 'Image bg' : `${Math.round(item.template.backgroundOpacity * 100)}% bg` }}</span>
                  </span>
                </span>
                <UIcon
                  :name="selectedTemplateId === item.template.id ? 'i-lucide-circle-check' : 'i-lucide-chevron-right'"
                  class="mt-1 size-4 shrink-0"
                  :class="selectedTemplateId === item.template.id ? 'text-primary' : 'text-dimmed group-hover:text-default'"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="p-6">
        <UAlert
          color="info"
          variant="soft"
          icon="i-lucide-file-json-2"
          title="No JSON values found"
          description="Load sample JSON first so generated layouts can bind real fields."
        />
        <UButton class="mt-4" icon="i-lucide-braces" label="Open JSON" color="neutral" variant="outline" @click="openJson" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full items-center justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
        <UButton
          v-if="selectedPreview"
          :label="`Use this ${selectedPreview.template.size} layout`"
          :disabled="Boolean(imageUrlError)"
          @click="applySelectedSize"
        />
      </div>
    </template>
  </UModal>
</template>
