<script setup lang="ts">
import type { ScriptableExportIssue } from '~/utils/scriptable'
import { getBindingIssues } from '~/utils/bindings'
import { ELEMENT_LABELS } from '~/utils/editor'

useSeoMeta({
  title: 'Scriptable Widget Studio',
  description: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.',
  ogTitle: 'Scriptable Widget Studio',
  ogDescription: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Scriptable Widget Studio',
  twitterDescription: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.'
})

const {
  document,
  activeLeftTab,
  selectedElement,
  templatePickerOpen,
  setActiveSize,
  selectElement,
  openTemplatePicker
} = useWidgetEditor()

const exportOpen = ref(false)
const mobileWorkspaceOpen = ref(false)
const inspectorOpen = ref(false)
const colorMode = useColorMode()
const bindingIssues = computed(() => getBindingIssues(document.value))
const isDark = computed(() => colorMode.value === 'dark')
const selectedElementLabel = computed(() => selectedElement.value.type === 'widget'
  ? `${document.value.activeSize} layout`
  : ELEMENT_LABELS[selectedElement.value.type])

function openData() {
  activeLeftTab.value = 'json'
}

function openEditor() {
  activeLeftTab.value = 'structure'
}

function openExport() {
  mobileWorkspaceOpen.value = false
  inspectorOpen.value = false
  exportOpen.value = true
}

function openMobileWorkspace(tab: 'structure' | 'json') {
  activeLeftTab.value = tab
  inspectorOpen.value = false
  mobileWorkspaceOpen.value = true
}

function openInspector() {
  mobileWorkspaceOpen.value = false
  inspectorOpen.value = true
}

function closeInspector() {
  inspectorOpen.value = false
}

function toggleColorMode() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

function openFirstIssue() {
  const issue = bindingIssues.value[0]
  if (!issue) return
  exportOpen.value = false
  setActiveSize(issue.size)
  selectElement(issue.elementId)
  if (import.meta.client && !window.matchMedia('(min-width: 1024px)').matches) openInspector()
}

function openExportIssue(issue: ScriptableExportIssue) {
  if (!issue.size || !issue.elementId) return
  exportOpen.value = false
  setActiveSize(issue.size)
  selectElement(issue.elementId)
  if (import.meta.client && !window.matchMedia('(min-width: 1024px)').matches) openInspector()
}
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-[var(--studio-chrome)]">
    <header class="hidden h-14 shrink-0 items-center border-b border-default bg-[var(--studio-panel)] px-3 shadow-[0_1px_0_color-mix(in_srgb,var(--ui-primary)_5%,transparent)] lg:flex">
      <div class="flex w-[clamp(15rem,23vw,18.5rem)] shrink-0 items-center gap-2.5">
        <div class="studio-mark">
          <UIcon name="i-lucide-brackets" class="size-4" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-semibold tracking-[-0.015em] text-highlighted">Widget Studio</h1>
          <p class="studio-panel-label text-muted">Scriptable / local</p>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 items-center justify-center gap-2 px-3">
        <EditorProjectMenu />
      </div>

      <div class="flex w-[clamp(18.75rem,28vw,22.25rem)] shrink-0 items-center justify-end gap-2">
        <UButton
          v-if="bindingIssues.length"
          icon="i-lucide-triangle-alert"
          :label="`${bindingIssues.length} ${bindingIssues.length === 1 ? 'issue' : 'issues'}`"
          color="warning"
          variant="soft"
          size="xs"
          @click="openFirstIssue"
        />
        <UTooltip :text="isDark ? 'Switch to light appearance' : 'Switch to dark appearance'">
          <UButton
            :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="isDark ? 'Switch to light appearance' : 'Switch to dark appearance'"
            @click="toggleColorMode"
          />
        </UTooltip>
        <div class="hidden items-center gap-1.5 text-muted lg:flex">
          <span class="size-1.5 rounded-full bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--color-teal-400)_65%,transparent)]" />
          <span class="studio-panel-label">Saved</span>
        </div>
        <UButton icon="i-lucide-share" label="Export widget" size="md" @click="openExport" />
      </div>
    </header>

    <header class="flex h-13 shrink-0 items-center gap-2 border-b border-default bg-[var(--studio-panel)] px-2 shadow-[0_1px_0_color-mix(in_srgb,var(--ui-primary)_5%,transparent)] lg:hidden">
      <div class="studio-mark size-8">
        <UIcon name="i-lucide-brackets" class="size-4" />
      </div>
      <EditorProjectMenu compact class="min-w-0 flex-1" />
      <UButton
        v-if="bindingIssues.length"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="soft"
        size="sm"
        square
        class="size-11 justify-center p-0"
        :aria-label="`${bindingIssues.length} ${bindingIssues.length === 1 ? 'binding issue' : 'binding issues'}`"
        @click="openFirstIssue"
      />
      <UButton
        :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="size-11 justify-center p-0"
        :aria-label="isDark ? 'Switch to light appearance' : 'Switch to dark appearance'"
        @click="toggleColorMode"
      />
    </header>

    <main class="min-h-0 flex-1 overflow-hidden">
      <UDashboardGroup
        storage="cookie"
        storage-key="scriptable-widget-studio"
        unit="px"
        :ui="{ base: 'relative flex h-full min-w-0 overflow-hidden' }"
      >
        <UDashboardSidebar
          id="workspace"
          resizable
          :toggle="false"
          :min-size="240"
          :default-size="296"
          :max-size="560"
          :ui="{
            root: 'min-h-0 bg-[var(--studio-panel)]',
            body: 'min-h-0 gap-0 overflow-hidden p-0'
          }"
        >
          <div class="grid h-12 shrink-0 grid-cols-2 gap-1 border-b border-muted p-1.5">
            <UButton
              icon="i-lucide-layers-3"
              label="Layers"
              :color="activeLeftTab === 'structure' ? 'primary' : 'neutral'"
              :variant="activeLeftTab === 'structure' ? 'soft' : 'ghost'"
              block
              @click="openEditor"
            />
            <UButton
              icon="i-lucide-plug-zap"
              label="Data"
              :color="activeLeftTab === 'json' ? 'primary' : 'neutral'"
              :variant="activeLeftTab === 'json' ? 'soft' : 'ghost'"
              block
              @click="openData"
            />
          </div>

          <EditorStructurePanel v-if="activeLeftTab === 'structure'" />
          <EditorJsonExplorerPanel v-else />
        </UDashboardSidebar>

        <EditorWidgetPreview />

        <aside class="hidden w-[clamp(18.75rem,28vw,22.25rem)] shrink-0 flex-col border-l border-default bg-[var(--studio-panel)] lg:flex">
          <EditorInspectorPanel />
        </aside>
      </UDashboardGroup>
    </main>

    <nav class="studio-mobile-dock grid shrink-0 grid-cols-4 gap-1 border-t border-default bg-[var(--studio-panel)] px-2 pt-2 lg:hidden" aria-label="Widget tools">
      <UButton
        icon="i-lucide-layers-3"
        label="Layers"
        color="neutral"
        variant="ghost"
        class="min-h-11 flex-col gap-0.5"
        :ui="{ label: 'text-[10px]' }"
        @click="openMobileWorkspace('structure')"
      />
      <UButton
        icon="i-lucide-plug-zap"
        label="Data"
        color="neutral"
        variant="ghost"
        class="min-h-11 flex-col gap-0.5"
        :ui="{ label: 'text-[10px]' }"
        @click="openMobileWorkspace('json')"
      />
      <UButton
        icon="i-lucide-wand-sparkles"
        label="Design"
        color="primary"
        variant="soft"
        class="min-h-11 flex-col gap-0.5"
        :ui="{ label: 'text-[10px]' }"
        @click="openTemplatePicker"
      />
      <UButton
        icon="i-lucide-share"
        label="Export"
        class="min-h-11 flex-col gap-0.5"
        :ui="{ label: 'text-[10px]' }"
        @click="openExport"
      />
    </nav>

    <UDrawer
      v-model:open="mobileWorkspaceOpen"
      :title="activeLeftTab === 'structure' ? 'Layers' : 'Data'"
      :description="activeLeftTab === 'structure' ? 'Add, reorder, or rename the layers in this layout.' : 'Choose where this widget gets its values and connect the fields it uses.'"
      handle-only
      :ui="{
        content: 'h-[78dvh]',
        container: 'min-h-0 gap-0 overflow-hidden p-0',
        header: 'shrink-0 border-b border-muted px-4 pb-3',
        body: 'flex min-h-0 flex-1'
      }"
    >
      <template #body>
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="grid shrink-0 grid-cols-2 gap-1 border-b border-muted bg-[var(--studio-panel)] p-1.5">
          <UButton
            icon="i-lucide-layers-3"
            label="Layers"
            :color="activeLeftTab === 'structure' ? 'primary' : 'neutral'"
            :variant="activeLeftTab === 'structure' ? 'soft' : 'ghost'"
            block
            @click="openEditor"
          />
          <UButton
            icon="i-lucide-plug-zap"
            label="Data"
            :color="activeLeftTab === 'json' ? 'primary' : 'neutral'"
            :variant="activeLeftTab === 'json' ? 'soft' : 'ghost'"
            block
            @click="openData"
          />
          </div>
          <EditorStructurePanel v-if="activeLeftTab === 'structure'" />
          <EditorJsonExplorerPanel v-else />
        </div>
      </template>
    </UDrawer>

    <USlideover
      v-model:open="inspectorOpen"
      side="right"
      :title="selectedElement.name"
      :description="selectedElementLabel"
      :ui="{ content: 'max-w-full sm:max-w-md', body: 'p-0 sm:p-0', footer: 'grid' }"
    >
      <template #body>
        <EditorInspectorPanel :show-header="false" />
      </template>
      <template #footer>
        <UButton label="Done" block @click="closeInspector" />
      </template>
    </USlideover>

    <EditorGeneratedCode v-model:open="exportOpen" @select-issue="openExportIssue" />
    <EditorTemplatePicker v-model:open="templatePickerOpen" />
  </div>
</template>
