<script setup lang="ts">
import type { DataTransform, DataTransformOperation, WidgetDataSource } from '~/types/editor'
import {
  createDataSource,
  generateUniversalDataProbeCode,
  isDataDiscoveryBundle,
  prepareSourceSample,
  sanitizeDataSource,
  TRANSFORM_LABELS
} from '~/utils/data'
import { createId, flattenJson, getValueAtPath } from '~/utils/editor'

const { document, previewData, usedVariablePaths, setSampleData, refreshDataBindings } = useWidgetEditor()
const { currentProject } = useProjectStore()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const jsonText = ref('')
const parseError = ref('')
const setupOpen = ref(false)

const hasData = computed(() => document.value.data.sampleData !== undefined)
const availableFieldCount = computed(() => new Set(flattenJson(previewData.value).map(leaf => leaf.path)).size)
const usedFieldCount = computed(() => usedVariablePaths.value.filter(path => getValueAtPath(previewData.value, path) !== undefined).length)
const probeCode = computed(() => generateUniversalDataProbeCode())
const sourceKind = computed<WidgetDataSource['kind']>({
  get: () => document.value.data.source.kind,
  set: kind => { document.value.data.source = createDataSource(kind) }
})

const sourceItems: { label: string, shortLabel: string, value: WidgetDataSource['kind'], icon: string }[] = [
  { label: 'Web API', shortLabel: 'API', value: 'http-json', icon: 'i-lucide-globe-2' },
  { label: 'Apple Shortcuts', shortLabel: 'Shortcut', value: 'shortcut', icon: 'i-lucide-workflow' },
  { label: 'Built-in values', shortLabel: 'Built-in', value: 'snapshot', icon: 'i-lucide-braces' }
]
const updateModeItems = [
  { label: 'Replace saved data', value: 'overwrite' },
  { label: 'Merge object fields', value: 'merge' },
  { label: 'Append each input', value: 'append' }
]
const operationItems = (Object.entries(TRANSFORM_LABELS) as [DataTransformOperation, string][])
  .map(([value, label]) => ({ label, value }))

const normalizedSample = computed(() => prepareSourceSample(document.value.data.sampleData, document.value.data.source))
const leafPathItems = computed(() => flattenJson(normalizedSample.value).map(leaf => ({ label: leaf.path, value: leaf.path })))
const arrayPathItems = computed(() => collectArrayPaths(normalizedSample.value).map(path => ({ label: path, value: path })))
const httpUrlError = computed(() => {
  if (document.value.data.source.kind !== 'http-json') return ''
  return /^https?:\/\//i.test(document.value.data.source.url.trim()) ? '' : 'Enter the complete public HTTP or HTTPS URL sampled on the phone.'
})

watch(() => currentProject.value.id, syncJsonText, { immediate: true })
watch(() => document.value.data.sampleData, syncJsonText)
watch(() => document.value.data.source, refreshDataBindings, { deep: true })

function syncJsonText() {
  jsonText.value = hasData.value ? JSON.stringify(document.value.data.sampleData, null, 2) : ''
  parseError.value = ''
}

function collectArrayPaths(value: unknown, path = '', depth = 0): string[] {
  if (depth > 5 || value === null || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    const nested = value.length ? collectArrayPaths(value[0], path ? `${path}.0` : '0', depth + 1) : []
    return path ? [path, ...nested] : nested
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => (
    collectArrayPaths(child, path ? `${path}.${key}` : key, depth + 1)
  ))
}

function applyParsedJson(value: unknown) {
  if (isDataDiscoveryBundle(value)) {
    document.value.data.source = sanitizeDataSource(value.source)
    document.value.data.sampledAt = value.observedAt
    setSampleData(value.sample)
    toast.add({
      title: 'Data sample connected',
      description: `${sourceItems.find(item => item.value === value.source.kind)?.label ?? 'Source'} settings and sample data were imported.`,
      color: 'success',
      icon: 'i-lucide-plug-zap'
    })
    return value.sample
  }

  setSampleData(value)
  document.value.data.sampledAt = new Date().toISOString()
  return value
}

function updateJson(value: string) {
  jsonText.value = value
  if (!value.trim()) {
    parseError.value = ''
    setSampleData(undefined)
    document.value.data.sampledAt = undefined
    return
  }
  try {
    const sample = applyParsedJson(JSON.parse(value))
    jsonText.value = JSON.stringify(sample, null, 2)
    parseError.value = ''
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : 'The JSON is not valid.'
  }
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  updateJson(await file.text())
  input.value = ''
}

function formatJson() {
  if (hasData.value) jsonText.value = JSON.stringify(document.value.data.sampleData, null, 2)
}

async function copyProbe() {
  try {
    await navigator.clipboard.writeText(probeCode.value)
    toast.add({ title: 'Data Probe copied', description: 'Create a Scriptable script and paste this code into it.', color: 'success', icon: 'i-lucide-copy-check' })
  } catch {
    downloadProbe()
    toast.add({ title: 'Data Probe downloaded', description: 'Clipboard access was blocked, so the JavaScript file was downloaded instead.', color: 'warning', icon: 'i-lucide-download' })
  }
}

function downloadProbe() {
  const blob = new Blob([probeCode.value], { type: 'text/javascript;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = 'scriptable-data-probe.js'
  anchor.click()
  URL.revokeObjectURL(url)
}

function addTransform() {
  const firstArray = arrayPathItems.value[0]?.value
  const firstLeaf = leafPathItems.value[0]?.value
  const operation: DataTransformOperation = firstArray ? 'count' : 'copy'
  document.value.data.transforms.push({
    id: createId('transform'),
    outputKey: '',
    operation,
    sourcePath: firstArray ?? firstLeaf ?? '',
    valuePath: ''
  })
}

function removeTransform(id: string) {
  const index = document.value.data.transforms.findIndex(transform => transform.id === id)
  if (index >= 0) document.value.data.transforms.splice(index, 1)
  refreshDataBindings()
}

function sourcePathItems(transform: DataTransform) {
  return ['count', 'sum', 'first', 'last'].includes(transform.operation)
    ? arrayPathItems.value
    : leafPathItems.value
}

function itemValueItems(transform: DataTransform) {
  const collection = getValueAtPath(normalizedSample.value, transform.sourcePath)
  if (!Array.isArray(collection) || !collection.length) return []
  const first = collection[0]
  if (first === null || typeof first !== 'object') return [{ label: 'Item value', value: '' }]
  const leaves = flattenJson(first).map(leaf => ({ label: leaf.path, value: leaf.path }))
  return transform.operation === 'sum' ? leaves : [{ label: 'Whole item', value: '' }, ...leaves]
}

function updateOperation(transform: DataTransform, operation: DataTransformOperation) {
  transform.operation = operation
  transform.valuePath = ''
  transform.sourcePath = sourcePathItems(transform)[0]?.value ?? ''
  refreshDataBindings()
}

function transformError(transform: DataTransform) {
  if (!transform.outputKey.trim()) return 'Enter the field name used by the widget.'
  if (!/^[a-zA-Z_$][\w$]*$/.test(transform.outputKey.trim())) return 'Use letters, numbers, _ or $, and begin with a letter.'
  if (!transform.sourcePath) return 'Choose a source value.'
  if (transform.operation === 'sum' && !itemValueItems(transform).length) return 'Choose an array containing numbers or numeric fields.'
  if (['days-until', 'hours-until', 'minutes-until'].includes(transform.operation)) {
    const value = getValueAtPath(normalizedSample.value, transform.sourcePath)
    if (Number.isNaN(new Date(value as string | number).getTime())) return 'Choose a value containing a valid date.'
  }
  return ''
}

function openSetup() {
  setupOpen.value = true
}

function selectSource(kind: WidgetDataSource['kind']) {
  sourceKind.value = kind
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-11 items-center justify-between border-b border-muted px-3">
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full" :class="hasData ? 'bg-success' : 'bg-dimmed'" />
        <p class="studio-panel-label text-muted">Widget values</p>
      </div>
      <UButton icon="i-lucide-route" label="Data Probe" color="neutral" variant="ghost" size="xs" @click="openSetup" />
    </div>

    <div class="studio-scrollbar min-h-0 flex-1 overflow-y-auto">
      <section class="space-y-3 border-b border-muted p-3">
        <div>
          <p class="studio-panel-label text-muted">Source</p>
          <p class="mt-1 text-xs leading-5 text-muted">Choose where the widget reads the values used in its layout.</p>
        </div>

        <div class="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          <UTooltip v-for="item in sourceItems" :key="item.value" :text="item.label">
            <UButton
              :icon="item.icon"
              :label="item.shortLabel"
              :color="sourceKind === item.value ? 'primary' : 'neutral'"
              :variant="sourceKind === item.value ? 'soft' : 'ghost'"
              size="xs"
              block
              @click="selectSource(item.value)"
            />
          </UTooltip>
        </div>

        <UFormField v-if="document.data.source.kind === 'http-json'" label="Public JSON URL" description="Requested by the generated widget and cached after each successful response." :error="httpUrlError || undefined">
          <UInput v-model="document.data.source.url" type="url" icon="i-lucide-link-2" class="w-full font-mono" />
        </UFormField>

        <template v-else-if="document.data.source.kind === 'shortcut'">
          <UFormField label="Incoming data">
            <USelect v-model="document.data.source.updateMode" :items="updateModeItems" class="w-full" />
          </UFormField>
          <UFormField
            v-if="document.data.source.updateMode === 'append'"
            label="Collection field"
            description="Each Shortcut dictionary is added to this array."
          >
            <UInput v-model="document.data.source.appendKey" class="w-full font-mono" />
          </UFormField>
        </template>

        <UAlert
          v-else
          color="neutral"
          variant="soft"
          icon="i-lucide-camera"
          title="Built-in values"
          description="The exported widget keeps these values in the script. Date calculations still update whenever it refreshes."
        />
      </section>

      <section class="space-y-3 border-b border-muted p-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="studio-panel-label text-muted">Sample</p>
            <p v-if="document.data.sampledAt" class="mt-1 text-[10px] text-toned">Captured {{ new Date(document.data.sampledAt).toLocaleString() }}</p>
          </div>
          <div class="flex items-center gap-1">
            <UButton v-if="hasData" label="Format" color="neutral" variant="ghost" size="xs" @click="formatJson" />
            <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="importFile">
            <UButton icon="i-lucide-upload" aria-label="Import JSON" color="neutral" variant="ghost" size="xs" @click="fileInput?.click()" />
          </div>
        </div>

        <UTextarea
          :model-value="jsonText"
          :rows="8"
          autoresize
          :maxrows="16"
          class="w-full font-mono text-xs"
          spellcheck="false"
          aria-label="Sample JSON"
          @update:model-value="updateJson(String($event))"
        />
        <p v-if="parseError" class="text-xs leading-5 text-error">{{ parseError }}</p>
        <p v-else class="text-xs leading-5 text-muted">Paste Data Probe output or raw JSON. Valid data updates the preview immediately.</p>
      </section>

      <section v-if="hasData" class="space-y-3 border-b border-muted p-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="studio-panel-label text-muted">Computed fields</p>
            <p class="mt-1 text-xs leading-5 text-muted">Create stable widget values from nested data and arrays.</p>
          </div>
          <UButton icon="i-lucide-plus" label="Add" color="neutral" variant="outline" size="xs" @click="addTransform" />
        </div>

        <div v-if="document.data.transforms.length" class="divide-y divide-muted border-y border-muted">
          <div v-for="(transform, index) in document.data.transforms" :key="transform.id" class="space-y-3 py-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-[10px] text-dimmed">{{ String(index + 1).padStart(2, '0') }}</span>
              <UButton icon="i-lucide-trash-2" aria-label="Remove computed field" color="neutral" variant="ghost" size="xs" @click="removeTransform(transform.id)" />
            </div>
            <UFormField label="Operation">
              <USelect
                :model-value="transform.operation"
                :items="operationItems"
                class="w-full"
                @update:model-value="updateOperation(transform, $event as DataTransformOperation)"
              />
            </UFormField>
            <UFormField label="Source value">
              <USelect v-model="transform.sourcePath" :items="sourcePathItems(transform)" class="w-full font-mono" @update:model-value="refreshDataBindings" />
            </UFormField>
            <UFormField v-if="['sum', 'first', 'last'].includes(transform.operation)" :label="transform.operation === 'sum' ? 'Number inside each item' : 'Value from the chosen item'">
              <USelect v-model="transform.valuePath" :items="itemValueItems(transform)" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Widget field name" :error="transformError(transform) || undefined">
              <UInput v-model="transform.outputKey" class="w-full font-mono" @update:model-value="refreshDataBindings" />
            </UFormField>
          </div>
        </div>
      </section>

      <section v-if="hasData" class="space-y-2 p-3">
        <div class="flex items-center justify-between">
          <p class="studio-panel-label text-muted">Fields</p>
          <div class="flex items-center gap-1.5">
            <UBadge color="neutral" variant="soft" :label="`${availableFieldCount} available`" size="sm" />
            <UBadge v-if="usedFieldCount" color="primary" variant="subtle" :label="`${usedFieldCount} used`" size="sm" />
          </div>
        </div>
        <p class="text-xs leading-5 text-muted">Enable fields for new bindings. Fields already used by a layout stay enabled.</p>
        <div class="rounded-md border border-muted bg-default p-1">
          <EditorJsonTreeNode label="widgetData" :value="previewData" path="" />
        </div>
      </section>

      <div v-if="!hasData" class="px-5 py-10 text-center">
        <UIcon name="i-lucide-plug-zap" class="mx-auto mb-3 size-6 text-dimmed" />
        <p class="text-sm font-medium text-default">Capture the widget’s real data</p>
        <p class="mx-auto mt-1 max-w-56 text-xs leading-5 text-muted">Run Data Probe on the phone, then paste its copied JSON here.</p>
        <UButton class="mt-3" icon="i-lucide-route" label="Get Data Probe" color="neutral" variant="outline" size="xs" @click="openSetup" />
      </div>
    </div>
  </section>

  <UModal
    v-model:open="setupOpen"
    title="Scriptable Data Probe"
    description="Use one temporary script to capture a real response before building the widget."
  >
    <template #body>
      <ol class="space-y-4 text-sm text-muted">
        <li class="flex gap-3">
          <span class="font-mono text-xs text-primary">01</span>
          <p><strong class="font-medium text-highlighted">Add Data Probe to Scriptable.</strong> Copy the code or download the JavaScript file, then save it as a new Scriptable script.</p>
        </li>
        <li class="flex gap-3">
          <span class="font-mono text-xs text-primary">02</span>
          <p><strong class="font-medium text-highlighted">Run it with real data.</strong> Enter a public JSON URL, read JSON from the clipboard, or pass a Dictionary from Apple Shortcuts.</p>
        </li>
        <li class="flex gap-3">
          <span class="font-mono text-xs text-primary">03</span>
          <p><strong class="font-medium text-highlighted">Return to this Data panel.</strong> Paste the JSON copied by Data Probe. Its source and fields will be connected automatically.</p>
        </li>
      </ol>
      <UAlert
        class="mt-5"
        color="warning"
        variant="soft"
        icon="i-lucide-key-round"
        title="Keep private keys on the phone"
        description="Data Probe supports public endpoints. Do not paste API keys, authorization headers, or account secrets into this editor."
      />
    </template>
    <template #footer>
      <UButton label="Download JavaScript" icon="i-lucide-download" color="neutral" variant="outline" @click="downloadProbe" />
      <UButton label="Copy Data Probe" icon="i-lucide-copy" class="ml-auto" @click="copyProbe" />
    </template>
  </UModal>
</template>
