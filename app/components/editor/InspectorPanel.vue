<script setup lang="ts">
import type { WidgetProperties } from '~/types/editor'
import { ELEMENT_ICONS, ELEMENT_LABELS, getValueAtPath } from '~/utils/editor'
import { SF_SYMBOL_NAMES } from '~/utils/sf-symbols'

withDefaults(defineProps<{
  showHeader?: boolean
}>(), {
  showHeader: true
})

const { document, activeSize, selectedElement, variableOptions, previewData } = useWidgetEditor()
const properties = computed<any>(() => selectedElement.value.properties)
const variableValueKind = computed<'number' | 'date' | 'text' | 'unknown'>(() => {
  if (selectedElement.value.type !== 'text' || properties.value.contentMode !== 'variable') return 'unknown'
  const value = getValueAtPath(previewData.value, properties.value.variable)
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') {
    const looksLikeDate = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(value)
    if (looksLikeDate && !Number.isNaN(new Date(value).getTime())) return 'date'
    return 'text'
  }
  if (typeof value === 'boolean') return 'text'
  return 'unknown'
})
const formattingKindLabel = computed(() => ({
  number: 'Number options',
  date: 'Date options',
  text: 'Text options',
  unknown: 'Formatting options'
}[variableValueKind.value]))
const showNumberFormatting = computed(() => variableValueKind.value === 'number' || variableValueKind.value === 'unknown')
const showDateFormatting = computed(() => variableValueKind.value === 'date' || variableValueKind.value === 'unknown')
const showTextFormatting = computed(() => variableValueKind.value === 'text' || variableValueKind.value === 'unknown')

function sharedWidgetProperty<K extends 'refreshInterval' | 'tapUrl'>(key: K) {
  return computed<WidgetProperties[K]>({
    get: () => (document.value.layouts.medium.properties as WidgetProperties)[key],
    set: (value) => {
      Object.values(document.value.layouts).forEach((root) => {
        ;(root.properties as WidgetProperties)[key] = value
      })
    }
  })
}

const refreshInterval = sharedWidgetProperty('refreshInterval')
const tapUrl = sharedWidgetProperty('tapUrl')

const alignmentItems = [
  { label: 'Leading', value: 'leading' },
  { label: 'Center', value: 'center' },
  { label: 'Trailing', value: 'trailing' }
]
const fontItems = [
  { label: 'System', value: 'system' },
  { label: 'Rounded', value: 'rounded' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospaced', value: 'monospaced' }
]
const weightItems = [
  { label: 'Ultralight', value: 'ultralight' },
  { label: 'Light', value: 'light' },
  { label: 'Regular', value: 'regular' },
  { label: 'Medium', value: 'medium' },
  { label: 'Semibold', value: 'semibold' },
  { label: 'Bold', value: 'bold' },
  { label: 'Heavy', value: 'heavy' },
  { label: 'Black', value: 'black' }
]
const textCaseItems = [
  { label: 'As provided', value: 'none' },
  { label: 'Uppercase', value: 'uppercase' },
  { label: 'Lowercase', value: 'lowercase' }
]

const backgroundImageModeItems = [
  { label: 'None', value: 'none' },
  { label: 'Static URL', value: 'static' },
  { label: 'Bound field', value: 'variable' }
]
const imageContentModeItems = [
  { label: 'Fit', value: 'fit' },
  { label: 'Fill', value: 'fill' }
]

const backgroundOpacityPercent = computed({
  get: () => Math.round((properties.value.backgroundOpacity ?? 1) * 100),
  set: (value: number) => {
    properties.value.backgroundOpacity = Math.max(0, Math.min(100, value)) / 100
  }
})

function updateRepeat(enabled: boolean) {
  properties.value.repeatCount = enabled ? Math.max(3, properties.value.repeatCount || 1) : 1
}
</script>

<template>
  <section class="studio-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--studio-panel)]">
    <div v-if="showHeader" class="flex h-12 items-center gap-2 border-b border-muted px-4">
      <span class="grid size-7 shrink-0 place-items-center rounded-[4px] border border-primary/25 bg-primary/10 text-primary">
        <UIcon :name="ELEMENT_ICONS[selectedElement.type]" class="size-3.5" />
      </span>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-default">{{ selectedElement.name }}</p>
        <p class="studio-panel-label text-muted">{{ selectedElement.type === 'widget' ? `${activeSize} layout` : ELEMENT_LABELS[selectedElement.type] }}</p>
      </div>
    </div>

    <div class="space-y-5 p-4">
      <datalist id="widget-variable-paths">
        <option v-for="option in variableOptions" :key="option.value" :value="option.value" />
      </datalist>

      <UFormField v-if="selectedElement.type !== 'widget'" label="Layer name">
        <UInput v-model="selectedElement.name" class="w-full" />
      </UFormField>

      <template v-if="selectedElement.type === 'widget'">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium capitalize text-default">{{ activeSize }} layout</p>
            <p class="text-xs text-muted">Appearance only affects this size.</p>
          </div>
          <UBadge
            :label="document.enabledSizes[activeSize] ? 'Included' : 'Not included'"
            :color="document.enabledSizes[activeSize] ? 'success' : 'warning'"
            variant="subtle"
          />
        </div>
        <UFormField label="Background color">
          <EditorColorField v-model="properties.backgroundColor" />
        </UFormField>
        <UFormField label="Background opacity" description="Applies to the color and image. Set to 0% for a clear background.">
          <div class="flex items-center gap-3">
            <USlider v-model="backgroundOpacityPercent" :min="0" :max="100" :step="1" class="min-w-0 flex-1" />
            <div class="flex shrink-0 items-center gap-1.5">
              <UInputNumber
                v-model="backgroundOpacityPercent"
                :min="0"
                :max="100"
                :step="1"
                class="w-28"
                :ui="{ base: 'tabular-nums' }"
              />
              <span class="text-xs text-muted">%</span>
            </div>
          </div>
        </UFormField>
        <div class="space-y-4 border-t border-muted pt-5">
          <p class="studio-panel-label text-muted">Background image</p>
          <UFormField label="Image source">
            <USelect v-model="properties.backgroundImageMode" :items="backgroundImageModeItems" class="w-full" />
          </UFormField>
          <UFormField v-if="properties.backgroundImageMode === 'static'" label="Image URL" description="The generated widget downloads this image when it refreshes.">
            <UInput v-model="properties.backgroundImageUrl" type="url" class="w-full" />
          </UFormField>
          <template v-else-if="properties.backgroundImageMode === 'variable'">
            <UFormField label="Data field" description="Enter a field now, even if the data source will be connected later.">
              <UInput v-model="properties.backgroundImageVariable" list="widget-variable-paths" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Fallback image URL">
              <UInput v-model="properties.backgroundImageFallbackUrl" type="url" class="w-full" />
            </UFormField>
          </template>
        </div>
        <UFormField label="Padding">
          <UInputNumber v-model="properties.padding" :min="0" :max="80" class="w-full" />
        </UFormField>

        <div class="space-y-4 border-t border-muted pt-5">
          <div>
            <p class="studio-panel-label text-muted">Shared behavior</p>
            <p class="mt-1 text-xs leading-5 text-muted">These settings apply to every widget size.</p>
          </div>
          <UFormField label="Refresh request" hint="min">
            <UInputNumber v-model="refreshInterval" :min="1" :max="1440" class="w-full" />
          </UFormField>
          <UFormField label="Tap URL">
            <UInput v-model="tapUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField label="Cache file name" description="Stores API responses or Shortcut input on this phone.">
            <UInput v-model="document.data.fileName" class="w-full font-mono" />
          </UFormField>
        </div>

      </template>

      <template v-else-if="selectedElement.type === 'verticalStack' || selectedElement.type === 'horizontalStack'">
        <div class="space-y-4">
          <p class="studio-panel-label text-muted">Layout</p>
          <UFormField label="Alignment">
            <USelect v-model="properties.alignment" :items="alignmentItems" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Spacing">
              <UInputNumber v-model="properties.spacing" :min="0" :max="100" class="w-full" />
            </UFormField>
            <UFormField label="Padding">
              <UInputNumber v-model="properties.padding" :min="0" :max="80" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="space-y-4 border-t border-muted pt-5">
          <p class="studio-panel-label text-muted">Appearance</p>
          <UFormField label="Background">
            <EditorColorField v-model="properties.backgroundColor" />
          </UFormField>
          <UFormField label="Corner radius">
            <UInputNumber v-model="properties.cornerRadius" :min="0" :max="80" class="w-full" />
          </UFormField>
        </div>

        <div class="space-y-4 border-t border-muted pt-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="studio-panel-label text-muted">Repeat group</p>
              <p class="mt-1 text-xs leading-5 text-muted">Design one group and repeat it along its parent row or column.</p>
            </div>
            <USwitch :model-value="(properties.repeatCount || 1) > 1" aria-label="Repeat this group" @update:model-value="updateRepeat" />
          </div>
          <template v-if="(properties.repeatCount || 1) > 1">
            <UFormField label="Instances" description="Use 3 for a compact strip or 7 for a full forecast.">
              <div class="flex items-center gap-2">
                <UInputNumber v-model="properties.repeatCount" :min="2" :max="12" class="min-w-0 flex-1" />
                <UButton label="3" color="neutral" variant="outline" @click="() => { properties.repeatCount = 3 }" />
                <UButton label="7" color="neutral" variant="outline" @click="() => { properties.repeatCount = 7 }" />
              </div>
            </UFormField>
            <UAlert
              color="info"
              variant="soft"
              icon="i-lucide-braces"
              title="Bind each instance by index"
              description="Use {index} in a field path, such as forecast.{index}.high. The first instance uses forecast.0.high."
            />
          </template>
        </div>
      </template>

      <template v-else-if="selectedElement.type === 'text'">
        <div class="space-y-4">
          <p class="studio-panel-label text-muted">Content</p>
          <UFormField label="Value">
            <div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              <UButton
                label="Static text"
                color="neutral"
                :variant="properties.contentMode === 'static' ? 'solid' : 'ghost'"
                block
                @click="() => { properties.contentMode = 'static' }"
              />
              <UButton
                label="Data field"
                color="neutral"
                :variant="properties.contentMode === 'variable' ? 'solid' : 'ghost'"
                block
                @click="() => { properties.contentMode = 'variable' }"
              />
            </div>
          </UFormField>
          <UFormField v-if="properties.contentMode === 'static'" label="Text">
            <UTextarea v-model="properties.content" autoresize :maxrows="5" class="w-full" />
          </UFormField>
          <template v-else>
            <UFormField label="Data field" description="Choose a field from the sample data or enter one that will be available later.">
              <UInput v-model="properties.variable" list="widget-variable-paths" class="w-full font-mono" />
            </UFormField>
            <UAlert
              v-if="!variableOptions.length"
              color="info"
              variant="soft"
              icon="i-lucide-braces"
              title="Design before connecting data"
              description="Type a field path now. The exported script will include it in the data contract."
            />
          </template>
        </div>

        <div class="space-y-4 border-t border-muted pt-5">
          <p class="studio-panel-label text-muted">Typography</p>
          <div class="grid grid-cols-[1fr_88px] gap-3">
            <UFormField label="Font">
              <USelect v-model="properties.font" :items="fontItems" class="w-full" />
            </UFormField>
            <UFormField label="Size">
              <UInputNumber v-model="properties.fontSize" :min="6" :max="80" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Weight">
            <USelect v-model="properties.weight" :items="weightItems" class="w-full" />
          </UFormField>
          <UFormField label="Color">
            <EditorColorField v-model="properties.color" />
          </UFormField>
        </div>

        <UCollapsible class="border-t border-muted">
          <template #default="{ open }">
            <UButton
              label="Advanced"
              icon="i-lucide-sliders-horizontal"
              :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              color="neutral"
              variant="ghost"
              block
              class="justify-between rounded-none px-0 pt-5"
            />
          </template>
          <template #content>
            <div class="space-y-4 pt-4">
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Opacity">
                  <UInputNumber v-model="properties.opacity" :min="0" :max="1" :step="0.05" class="w-full" />
                </UFormField>
                <UFormField label="Line limit">
                  <UInputNumber v-model="properties.lineLimit" :min="1" :max="20" class="w-full" />
                </UFormField>
              </div>

              <template v-if="properties.contentMode === 'variable'">
                <div class="flex items-center justify-between border-t border-muted pt-4">
                  <p class="studio-panel-label text-muted">{{ formattingKindLabel }}</p>
                  <UBadge v-if="variableValueKind !== 'unknown'" :label="variableValueKind" color="neutral" variant="subtle" size="sm" />
                </div>

                <template v-if="showNumberFormatting">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm text-default">Round number</p>
                      <p class="text-xs text-muted">Use the nearest whole number.</p>
                    </div>
                    <USwitch v-model="properties.format.round" aria-label="Round number" />
                  </div>
                  <UFormField label="Decimal places">
                    <UInputNumber v-model="properties.format.decimals" :min="0" :max="8" class="w-full" />
                  </UFormField>
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm text-default">Percentage</p>
                      <p class="text-xs text-muted">Multiply by 100 and add %.</p>
                    </div>
                    <USwitch v-model="properties.format.percentage" aria-label="Format as percentage" />
                  </div>
                  <UFormField label="Currency symbol">
                    <UInput v-model="properties.format.currency" class="w-full" />
                  </UFormField>
                </template>

                <div class="grid grid-cols-2 gap-3">
                  <UFormField label="Prefix">
                    <UInput v-model="properties.format.prefix" class="w-full" />
                  </UFormField>
                  <UFormField label="Suffix">
                    <UInput v-model="properties.format.suffix" class="w-full" />
                  </UFormField>
                </div>
                <UFormField v-if="showTextFormatting" label="Letter case">
                  <USelect v-model="properties.format.textCase" :items="textCaseItems" class="w-full" />
                </UFormField>
                <UFormField v-if="showDateFormatting" label="Date format">
                  <UInput v-model="properties.format.dateFormat" class="w-full font-mono" />
                </UFormField>
                <UFormField label="Fallback value">
                  <UInput v-model="properties.format.fallback" class="w-full" />
                </UFormField>
              </template>
            </div>
          </template>
        </UCollapsible>
      </template>

      <template v-else-if="selectedElement.type === 'image'">
        <UFormField label="Source">
          <div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <UButton label="SF Symbol" color="neutral" :variant="properties.sourceType === 'symbol' ? 'solid' : 'ghost'" block @click="() => { properties.sourceType = 'symbol' }" />
            <UButton label="Remote URL" color="neutral" :variant="properties.sourceType === 'remote' ? 'solid' : 'ghost'" block @click="() => { properties.sourceType = 'remote' }" />
          </div>
        </UFormField>
        <UFormField
          v-if="properties.sourceType === 'symbol'"
          label="SF Symbol name"
          description="Search common symbols or enter any valid SF Symbol name."
        >
          <UInputMenu
            v-model="properties.systemSymbol"
            :items="SF_SYMBOL_NAMES"
            mode="autocomplete"
            placeholder="Search or enter a symbol name"
            open-on-focus
            :virtualize="{ estimateSize: 32 }"
            class="w-full"
            :ui="{ base: 'font-mono', itemLabel: 'font-mono' }"
          />
        </UFormField>
        <template v-else>
          <UFormField label="Remote image value">
            <div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              <UButton label="Static URL" color="neutral" :variant="properties.remoteMode === 'static' ? 'solid' : 'ghost'" block @click="() => { properties.remoteMode = 'static' }" />
              <UButton label="Data field" color="neutral" :variant="properties.remoteMode === 'variable' ? 'solid' : 'ghost'" block @click="() => { properties.remoteMode = 'variable' }" />
            </div>
          </UFormField>
          <UFormField v-if="properties.remoteMode === 'static'" label="Remote image URL">
            <UInput v-model="properties.remoteUrl" type="url" class="w-full" />
          </UFormField>
          <template v-else>
            <UFormField label="Data field" description="Choose a field or enter one that uses {index} inside a repeated group.">
              <UInput v-model="properties.variable" list="widget-variable-paths" class="w-full font-mono" />
            </UFormField>
            <UFormField label="Fallback URL">
              <UInput v-model="properties.fallbackUrl" type="url" class="w-full" />
            </UFormField>
          </template>
        </template>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Width">
            <UInputNumber v-model="properties.width" :min="1" :max="500" class="w-full" />
          </UFormField>
          <UFormField label="Height">
            <UInputNumber v-model="properties.height" :min="1" :max="500" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-if="properties.sourceType === 'symbol'" label="Tint">
          <EditorColorField v-model="properties.tintColor" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Content mode">
            <USelect v-model="properties.contentMode" :items="imageContentModeItems" class="w-full" />
          </UFormField>
          <UFormField label="Opacity">
            <UInputNumber v-model="properties.opacity" :min="0" :max="1" :step="0.05" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Corner radius">
          <UInputNumber v-model="properties.cornerRadius" :min="0" :max="100" class="w-full" />
        </UFormField>
      </template>

      <template v-else-if="selectedElement.type === 'date'">
        <UFormField label="Date value">
          <div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <UButton label="Current date" color="neutral" :variant="properties.sourceType === 'now' ? 'solid' : 'ghost'" block @click="() => { properties.sourceType = 'now' }" />
            <UButton label="Data field" color="neutral" :variant="properties.sourceType === 'variable' ? 'solid' : 'ghost'" block @click="() => { properties.sourceType = 'variable' }" />
          </div>
        </UFormField>
        <template v-if="properties.sourceType === 'variable'">
          <UFormField label="Data field" description="Choose a field or enter one that uses {index} inside a repeated group.">
            <UInput v-model="properties.variable" list="widget-variable-paths" class="w-full font-mono" />
          </UFormField>
          <UFormField label="Fallback value">
            <UInput v-model="properties.fallback" class="w-full" />
          </UFormField>
        </template>
        <UFormField label="Date format">
          <UInput v-model="properties.dateFormat" class="w-full font-mono" />
        </UFormField>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm text-default">Relative date</p>
            <p class="text-xs text-muted">Show time relative to now.</p>
          </div>
          <USwitch v-model="properties.relativeDate" aria-label="Show relative date" />
        </div>
        <UFormField label="Font">
          <USelect v-model="properties.font" :items="fontItems" class="w-full" />
        </UFormField>
        <UFormField label="Color">
          <EditorColorField v-model="properties.color" />
        </UFormField>
      </template>

      <template v-else-if="selectedElement.type === 'spacer'">
        <UFormField label="Behavior">
          <div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <UButton
              label="Flexible"
              color="neutral"
              :variant="(properties.mode || 'fixed') === 'flexible' ? 'solid' : 'ghost'"
              block
              @click="() => { properties.mode = 'flexible' }"
            />
            <UButton
              label="Fixed gap"
              color="neutral"
              :variant="(properties.mode || 'fixed') === 'fixed' ? 'solid' : 'ghost'"
              block
              @click="() => { properties.mode = 'fixed' }"
            />
          </div>
        </UFormField>
        <p class="text-xs leading-5 text-muted">
          {{ (properties.mode || 'fixed') === 'flexible'
            ? 'Expands to push the next layer to the opposite edge.'
            : 'Keeps an exact gap along the parent stack direction.' }}
        </p>
        <UFormField v-if="(properties.mode || 'fixed') === 'fixed'" label="Gap size" hint="pt">
          <UInputNumber v-model="properties.size" :min="0" :max="300" class="w-full" />
        </UFormField>
      </template>
    </div>
  </section>
</template>
