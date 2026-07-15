<script setup lang="ts">
import { getBindingIssues } from '~/utils/bindings'
import { getUsedVariablePaths } from '~/utils/bindings'
import { DATA_SOURCE_LABELS } from '~/utils/data'
import { generateScriptableCode } from '~/utils/scriptable'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ selectIssue: [] }>()
const { document } = useWidgetEditor()
const { currentProject } = useProjectStore()
const toast = useToast()
const setupOpen = ref(false)
const manualCopyOpen = ref(false)
const manualCopyInput = ref<HTMLTextAreaElement | null>(null)
const code = computed(() => generateScriptableCode(document.value))
const lineCount = computed(() => code.value.split('\n').length)
const bindingIssues = computed(() => getBindingIssues(document.value))
const usedVariablePaths = computed(() => getUsedVariablePaths(document.value))
const enabledSizes = computed(() => Object.entries(document.value.enabledSizes)
  .filter(([, enabled]) => enabled)
  .map(([size]) => size.charAt(0).toUpperCase() + size.slice(1)))
const sourceLabel = computed(() => DATA_SOURCE_LABELS[document.value.data.source.kind])
const runtimeLabel = computed(() => {
  if (!usedVariablePaths.value.length) return 'Visual layout with optional data adapter'
  if (document.value.data.source.kind === 'http-json') return 'Web API, cache, widget, and preview'
  if (document.value.data.source.kind === 'shortcut') return 'Shortcut input, storage, widget, and preview'
  return 'Captured data, widget, and preview'
})

async function copyCode() {
  let copied = false

  try {
    await navigator.clipboard.writeText(code.value)
    copied = true
  } catch {
    const textarea = window.document.createElement('textarea')
    textarea.value = code.value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    window.document.body.appendChild(textarea)
    textarea.select()
    copied = window.document.execCommand('copy')
    textarea.remove()
  }

  if (copied) {
    toast.add({ title: 'Script copied', description: 'The generated JavaScript is ready to paste into Scriptable.', color: 'success', icon: 'i-lucide-check' })
  } else {
    manualCopyOpen.value = true
    await nextTick()
    manualCopyInput.value?.select()
    toast.add({ title: 'Copy permission blocked', description: 'The full script is selected. Press Command+C to copy it.', color: 'warning', icon: 'i-lucide-copy' })
  }
}

function downloadCode() {
  const blob = new Blob([code.value], { type: 'text/javascript;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${currentProject.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'scriptable-widget'}.js`
  anchor.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Script downloaded', description: `${anchor.download} was created.`, color: 'success', icon: 'i-lucide-download' })
}

function openSetup() {
  setupOpen.value = true
}

function closeSetup() {
  setupOpen.value = false
}

function closeManualCopy() {
  manualCopyOpen.value = false
}

function selectIssue() {
  emit('selectIssue')
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Export Scriptable widget"
    description="Review the generated script, then copy or download it for Scriptable."
    :ui="{ content: 'max-w-full sm:max-w-2xl', body: 'p-0 sm:p-0', footer: 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap' }"
  >
    <template #body>
      <div class="border-b border-muted">
        <div class="grid grid-cols-[7rem_1fr] gap-4 border-b border-muted px-5 py-4 sm:px-6">
          <span class="text-xs font-medium text-muted">Data source</span>
          <span class="text-sm font-medium text-highlighted">{{ sourceLabel }}</span>
        </div>
        <div class="grid grid-cols-[7rem_1fr] gap-4 border-b border-muted px-5 py-4 sm:px-6">
          <span class="text-xs font-medium text-muted">Included sizes</span>
          <span class="text-sm font-medium text-highlighted">{{ enabledSizes.join(', ') }}</span>
        </div>
        <div class="grid grid-cols-[7rem_1fr] gap-4 px-5 py-4 sm:px-6">
          <span class="text-xs font-medium text-muted">Generated script</span>
          <span class="text-sm text-highlighted">{{ lineCount }} lines · {{ runtimeLabel }}</span>
        </div>
      </div>

      <div class="space-y-4 p-5 sm:p-6">
        <UAlert
          v-if="bindingIssues.length"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="`${bindingIssues.length} ${bindingIssues.length === 1 ? 'binding needs' : 'bindings need'} attention`"
          :description="`${bindingIssues[0]?.elementName} references ${bindingIssues[0]?.variable}, which is missing from the current data sample.`"
          :actions="[{ label: 'View layer', color: 'warning', variant: 'outline', onClick: selectIssue }]"
        />
        <UAlert
          v-else-if="usedVariablePaths.length"
          color="success"
          variant="soft"
          icon="i-lucide-circle-check"
          title="Ready to export"
          description="Every bound field is present in the current data sample."
        />
        <UAlert
          v-else
          color="success"
          variant="soft"
          icon="i-lucide-palette"
          title="Visual widget ready"
          description="This layout has no bound fields. The exported script still includes a data adapter for later."
        />

        <UCollapsible class="border-y border-muted">
          <template #default="{ open: codeOpen }">
            <UButton
              label="View generated code"
              icon="i-lucide-file-code-2"
              :trailing-icon="codeOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              color="neutral"
              variant="ghost"
              block
              class="justify-between rounded-none px-0"
            />
          </template>
          <template #content>
            <pre class="studio-scrollbar mt-3 max-h-[48vh] overflow-auto rounded-md bg-inverted p-4 font-mono text-[11px] leading-[1.65] text-inverted/75"><code>{{ code }}</code></pre>
          </template>
        </UCollapsible>
      </div>
    </template>

    <template #footer>
      <UButton label="Install on iPhone" icon="i-lucide-route" color="neutral" variant="soft" class="col-span-2 sm:col-span-1" @click="openSetup" />
      <div class="hidden min-w-4 flex-1 sm:block" />
      <UButton label="Download" icon="i-lucide-download" color="neutral" variant="outline" @click="downloadCode" />
      <UButton label="Copy script" icon="i-lucide-copy" @click="copyCode" />
    </template>
  </USlideover>

  <UModal
    v-model:open="setupOpen"
    title="Install the generated widget"
    description="This is the permanent script that retrieves the configured source and renders your layouts."
  >
    <template #body>
      <ol class="space-y-4 text-sm text-muted">
        <li class="flex gap-3">
          <span class="font-mono text-xs text-primary">01</span>
          <p><strong class="font-medium text-highlighted">Add the script to Scriptable.</strong> Copy or download this code, create a new Scriptable script, and paste it in.</p>
        </li>
        <li v-if="document.data.source.kind === 'http-json'" class="flex gap-3">
          <span class="font-mono text-xs text-primary">02</span>
          <p><strong class="font-medium text-highlighted">Run it once in Scriptable.</strong> Confirm that the public JSON endpoint responds and that the widget preview renders. Successful responses are cached for offline fallback.</p>
        </li>
        <li v-else-if="document.data.source.kind === 'shortcut'" class="flex gap-3">
          <span class="font-mono text-xs text-primary">02</span>
          <p><strong class="font-medium text-highlighted">Connect Apple Shortcuts.</strong> Add Scriptable’s Run Script action, choose this generated script, and pass the Dictionary or List that updates the widget.</p>
        </li>
        <li class="flex gap-3">
          <span class="font-mono text-xs text-primary">{{ document.data.source.kind === 'snapshot' ? '02' : '03' }}</span>
          <p><strong class="font-medium text-highlighted">Add a Scriptable widget.</strong> Select this script in the widget settings. Each included widget size uses its matching generated layout.</p>
        </li>
      </ol>
    </template>

    <template #footer>
      <UButton label="Done" color="neutral" variant="soft" class="ml-auto" @click="closeSetup" />
    </template>
  </UModal>

  <UModal
    v-model:open="manualCopyOpen"
    title="Copy Scriptable code"
    description="Clipboard access is blocked. The complete script is selected and ready for Command+C."
  >
    <template #body>
      <textarea
        ref="manualCopyInput"
        :value="code"
        readonly
        aria-label="Generated Scriptable code"
        class="studio-scrollbar h-80 w-full resize-none rounded-md border border-default bg-elevated p-3 font-mono text-xs leading-relaxed text-highlighted outline-none focus:ring-2 focus:ring-primary"
      />
    </template>

    <template #footer>
      <UButton label="Download instead" icon="i-lucide-download" color="neutral" variant="soft" @click="downloadCode" />
      <UButton label="Done" color="primary" class="ml-auto" @click="closeManualCopy" />
    </template>
  </UModal>
</template>
