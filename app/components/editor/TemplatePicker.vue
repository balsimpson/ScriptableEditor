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
  TEMPLATE_DOMAIN_LABELS
} from '~/utils/templates'

const open = defineModel<boolean>('open', { default: false })
const { document, selectedElementId, activeLeftTab } = useWidgetEditor()
const toast = useToast()
const targetSize = ref<PreviewSize>(document.value.activeSize)
const generation = ref(0)
const selectedTemplateId = ref('')
const showCountdownLabel = ref(true)
const countdownImageUrl = ref('')
const optionSetCount = 4

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
  countdownImageUrl.value = ''
})

function previewStyle(template: WidgetTemplate, root: EditorDocument['layouts'][PreviewSize]): CSSProperties {
  const size = dimensions[template.size]
  const properties = root.properties as WidgetProperties
  const scale = Math.min(220 / size.width, 126 / size.height)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
    padding: `${properties.padding}px`,
    backgroundColor: properties.backgroundColor,
    transform: `translate(-50%, -50%) scale(${scale})`
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

function generateNewOptions() {
  generation.value = (generation.value + 1) % optionSetCount
}

function applyAllSizes() {
  if (!variables.value.length) return
  const replacing = hasExistingLayouts.value
  const previous = snapshotDocument()
  const result = applyAdaptiveTemplateSet(document.value, generation.value, contentOptions.value)
  selectedElementId.value = result.layouts.medium.id
  open.value = false
  toast.add({
    title: replacing ? 'All size layouts replaced' : 'Three data-aware layouts created',
    description: isCountdown.value
      ? 'Each size uses the day count, plus only the label and image you chose.'
      : 'Each size uses a restrained number of values suited to its available space.',
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
    title="Generate size layouts"
    description="Create varied options from the meaning and shape of your JSON, then apply one layout or build all three sizes."
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-5xl', body: 'p-0 sm:p-0' }"
  >
    <template #body>
      <div v-if="variables.length">
        <div class="flex flex-col gap-4 border-b border-muted bg-elevated px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div class="flex min-w-0 flex-1 items-start gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-inverted">
              <UIcon name="i-lucide-panels-top-left" class="size-4.5" />
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-highlighted">Data-aware layout set</p>
                <UBadge :label="TEMPLATE_DOMAIN_LABELS[domain]" color="neutral" variant="subtle" size="sm" />
              </div>
              <p class="mt-0.5 text-xs leading-5 text-muted">Each size gets its own hierarchy instead of stretching one composition.</p>
            </div>
          </div>
          <UButton
            icon="i-lucide-wand-sparkles"
            :label="hasExistingLayouts ? 'Replace all sizes' : 'Build all sizes'"
            :disabled="Boolean(imageUrlError)"
            @click="applyAllSizes"
          />
        </div>

        <div v-if="isCountdown" class="grid gap-4 border-b border-muted px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,1.2fr)] sm:px-6">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-default">Event label</p>
              <p class="mt-0.5 text-xs leading-5 text-muted">
                {{ countdownLabel ? `Show ${countdownLabel.label} above the day count.` : 'No event label field was detected.' }}
              </p>
            </div>
            <USwitch v-model="showCountdownLabel" :disabled="!countdownLabel" aria-label="Show event label" />
          </div>

          <UFormField
            label="Image URL"
            hint="Optional"
            :description="detectedImage ? `Leave blank to use ${detectedImage.label} from the JSON.` : 'Add a remote image to the generated countdown layouts.'"
            :error="imageUrlError || undefined"
          >
            <UInput v-model="countdownImageUrl" type="url" icon="i-lucide-image" class="w-full" />
          </UFormField>
        </div>

        <div class="flex flex-col gap-3 border-b border-muted px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div class="flex items-center gap-1 rounded-md bg-muted p-0.5">
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

          <div class="flex items-center justify-between gap-3 sm:justify-end">
            <p class="text-xs text-muted">Option set {{ generation + 1 }} of {{ optionSetCount }}</p>
            <UButton
              icon="i-lucide-refresh-cw"
              label="Show more options"
              color="neutral"
              variant="outline"
              size="sm"
              @click="generateNewOptions"
            />
          </div>
        </div>

        <div class="border-b border-muted px-5 py-3 sm:px-6">
          <p class="text-xs text-muted">
            <span class="font-medium text-default">{{ variables.length }} JSON {{ variables.length === 1 ? 'field' : 'fields' }} available.</span>
            {{ isCountdown
              ? 'These options use the day count, with only the optional label and image above.'
              : `Choose an option for the ${targetSize} widget or show another set.` }}
          </p>
        </div>

        <div class="studio-scrollbar max-h-[55vh] overflow-y-auto p-4 sm:p-5">
          <div class="grid gap-px overflow-hidden rounded-lg border border-muted bg-muted sm:grid-cols-2 lg:grid-cols-4">
            <button
              v-for="item in previews"
              :key="item.template.id"
              type="button"
              class="relative min-w-0 bg-default text-left outline-none transition-colors hover:bg-elevated focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary"
              :class="selectedTemplateId === item.template.id ? 'bg-accented' : ''"
              :aria-pressed="selectedTemplateId === item.template.id"
              @click="selectedTemplateId = item.template.id"
            >
              <div class="studio-grid relative h-40 overflow-hidden border-b border-muted">
                <div
                  class="pointer-events-none absolute left-1/2 top-1/2 overflow-hidden rounded-[22px] shadow-[0_16px_42px_rgba(15,23,42,0.22)]"
                  :style="previewStyle(item.template, item.built.root)"
                >
                  <div class="flex size-full min-h-0 min-w-0 flex-col">
                    <EditorPreviewNode v-for="child in item.built.root.children" :key="child.id" :element="child" direction="vertical" />
                  </div>
                </div>
                <span v-if="selectedTemplateId === item.template.id" class="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-primary text-inverted shadow-sm">
                  <UIcon name="i-lucide-check" class="size-3.5" />
                </span>
              </div>

              <div class="flex items-start gap-3 p-4">
                <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-elevated" :style="{ color: item.template.accent }">
                  <UIcon :name="item.template.icon" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-semibold text-highlighted">{{ item.template.name }}</p>
                    <UBadge :label="item.template.layout" color="neutral" variant="subtle" size="sm" />
                  </div>
                  <p class="mt-1 text-xs leading-5 text-muted">{{ item.template.description }}</p>
                  <p class="mt-2 truncate text-[11px] text-toned">{{ item.built.usedPaths.map(path => variableLabels.get(path) || path).join(' · ') }}</p>
                </div>
              </div>
            </button>
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
          :label="`Use ${selectedPreview.template.name} for ${selectedPreview.template.size}`"
          color="neutral"
          variant="solid"
          :disabled="Boolean(imageUrlError)"
          @click="applySelectedSize"
        />
      </div>
    </template>
  </UModal>
</template>
