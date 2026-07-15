<script setup lang="ts">
import type { ScriptableExportIssue } from '~/utils/scriptable'
import { getUsedVariablePaths } from '~/utils/bindings'
import { DATA_SOURCE_LABELS } from '~/utils/data'
import { generateScriptableCode, getScriptableExportIssues } from '~/utils/scriptable'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ selectIssue: [issue: ScriptableExportIssue] }>()
const { document } = useWidgetEditor()
const { currentProject } = useProjectStore()
const toast = useToast()
const setupOpen = ref(false)
const manualCopyOpen = ref(false)
const manualCopyInput = ref<HTMLTextAreaElement | null>(null)
const code = computed(() => generateScriptableCode(document.value, {
  projectId: currentProject.value.id,
  projectName: currentProject.value.name
}))
const lineCount = computed(() => code.value.split('\n').length)
const exportIssues = computed(() => getScriptableExportIssues(document.value))
const blockingIssues = computed(() => exportIssues.value.filter(issue => issue.severity === 'error'))
const warningIssues = computed(() => exportIssues.value.filter(issue => issue.severity === 'warning'))
const primaryIssue = computed(() => blockingIssues.value[0] ?? warningIssues.value[0])
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
  if (blockingIssues.value.length) {
    toast.add({ title: 'Export needs attention', description: primaryIssue.value?.fix, color: 'error', icon: 'i-lucide-circle-x' })
    return
  }
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
  if (blockingIssues.value.length) {
    toast.add({ title: 'Export needs attention', description: primaryIssue.value?.fix, color: 'error', icon: 'i-lucide-circle-x' })
    return
  }
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

function selectIssue(issue: ScriptableExportIssue) {
  emit('selectIssue', issue)
}

function selectPrimaryIssue() {
  if (primaryIssue.value) selectIssue(primaryIssue.value)
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
          v-if="blockingIssues.length"
          color="error"
          variant="soft"
          icon="i-lucide-circle-x"
          :title="`${blockingIssues.length} ${blockingIssues.length === 1 ? 'problem prevents' : 'problems prevent'} a safe export`"
          :description="`${primaryIssue?.code}: ${primaryIssue?.description} ${primaryIssue?.fix}`"
          :actions="primaryIssue?.elementId ? [{ label: 'View setting', color: 'error', variant: 'outline', onClick: selectPrimaryIssue }] : undefined"
        />
        <UAlert
          v-else-if="warningIssues.length"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          :title="`Ready with ${warningIssues.length} ${warningIssues.length === 1 ? 'warning' : 'warnings'}`"
          :description="`${primaryIssue?.code}: ${primaryIssue?.description} ${primaryIssue?.fix}`"
          :actions="primaryIssue?.elementId ? [{ label: 'View setting', color: 'warning', variant: 'outline', onClick: selectPrimaryIssue }] : undefined"
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

        <div v-if="exportIssues.length" class="divide-y divide-muted border-y border-muted">
          <div v-for="issue in exportIssues" :key="`${issue.code}-${issue.location || issue.title}`" class="flex items-start gap-3 py-3">
            <UIcon :name="issue.severity === 'error' ? 'i-lucide-circle-x' : 'i-lucide-triangle-alert'" :class="issue.severity === 'error' ? 'mt-0.5 size-4 shrink-0 text-error' : 'mt-0.5 size-4 shrink-0 text-warning'" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">{{ issue.code }} · {{ issue.title }}</p>
              <p class="mt-1 text-xs leading-5 text-muted">{{ issue.description }}</p>
              <p class="mt-1 text-xs leading-5 text-muted"><span class="font-medium text-default">Fix:</span> {{ issue.fix }}</p>
            </div>
            <UButton v-if="issue.elementId" label="Open" color="neutral" variant="ghost" size="xs" @click="selectIssue(issue)" />
          </div>
        </div>

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
      <UButton label="Installation steps" icon="i-lucide-route" color="neutral" variant="soft" class="col-span-2 sm:col-span-1" @click="openSetup" />
      <div class="hidden min-w-4 flex-1 sm:block" />
      <UButton label="Download" icon="i-lucide-download" color="neutral" variant="outline" :disabled="blockingIssues.length > 0" @click="downloadCode" />
      <UButton label="Copy script" icon="i-lucide-copy" :disabled="blockingIssues.length > 0" @click="copyCode" />
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
          <p><strong class="font-medium text-highlighted">Add a Scriptable Home Screen widget.</strong> Select this script in the widget settings. Small, Medium, and Large use their matching generated layouts; Lock Screen accessory families are not included.</p>
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
