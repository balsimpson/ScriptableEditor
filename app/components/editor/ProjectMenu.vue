<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WidgetStarterId } from '~/utils/starters'
import { createWidgetStarterDocument, getWidgetStarter, WIDGET_STARTERS } from '~/utils/starters'

withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false
})

const {
  state,
  currentProject,
  activateProject,
  newProject,
  duplicateProject,
  renameProject,
  deleteProject,
  exportProject,
  importProject
} = useProjectStore()

const toast = useToast()
const importInput = ref<HTMLInputElement | null>(null)
const nameModalOpen = ref(false)
const deleteModalOpen = ref(false)
const nameMode = ref<'new' | 'rename'>('new')
const nameDraft = ref('')
const selectedStarterId = ref<WidgetStarterId>('blank')

const items = computed<DropdownMenuItem[][]>(() => [
  state.value.projects.map(project => ({
    label: project.name,
    icon: project.id === currentProject.value.id ? 'i-lucide-check' : 'i-lucide-file',
    onSelect: () => activateProject(project.id)
  })),
  [
    { label: 'New project', icon: 'i-lucide-file-plus-2', onSelect: openNew },
    { label: 'Duplicate project', icon: 'i-lucide-copy-plus', onSelect: () => duplicateProject() },
    { label: 'Rename project', icon: 'i-lucide-pencil', onSelect: openRename },
    { label: 'Export project', icon: 'i-lucide-download', onSelect: downloadCurrent },
    { label: 'Import project', icon: 'i-lucide-upload', onSelect: () => importInput.value?.click() }
  ],
  [
    { label: 'Delete project', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { deleteModalOpen.value = true } }
  ]
])

function openNew() {
  nameMode.value = 'new'
  selectedStarterId.value = 'blank'
  nameDraft.value = getWidgetStarter('blank').projectName
  nameModalOpen.value = true
}

function openRename() {
  nameMode.value = 'rename'
  nameDraft.value = currentProject.value.name
  nameModalOpen.value = true
}

function saveName() {
  const name = nameDraft.value.trim()
  if (!name) return
  if (nameMode.value === 'new') newProject(name, createWidgetStarterDocument(selectedStarterId.value))
  else renameProject(currentProject.value.id, name)
  nameModalOpen.value = false
}

function selectStarter(id: WidgetStarterId) {
  selectedStarterId.value = id
  nameDraft.value = getWidgetStarter(id).projectName
}

function confirmDelete() {
  deleteProject(currentProject.value.id)
  deleteModalOpen.value = false
  toast.add({ title: 'Project deleted', color: 'success', icon: 'i-lucide-check' })
}

function downloadCurrent() {
  const content = exportProject()
  if (!content) return
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${currentProject.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'widget'}.scriptable-project.json`
  anchor.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Project exported', description: anchor.download, color: 'success', icon: 'i-lucide-download' })
}

async function readImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const project = importProject(await file.text())
    toast.add({ title: 'Project imported', description: project.name, color: 'success', icon: 'i-lucide-upload' })
  } catch (error) {
    toast.add({
      title: 'Import failed',
      description: error instanceof Error ? error.message : 'The project file could not be read.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="min-w-0">
    <input ref="importInput" type="file" accept=".json,application/json" class="hidden" @change="readImport">
    <div class="flex min-w-0 items-center gap-1.5">
      <UDropdownMenu :items="items" :content="{ align: 'center', sideOffset: 8 }">
        <UButton
          icon="i-lucide-folder-open"
          :label="currentProject.name"
          trailing-icon="i-lucide-chevrons-up-down"
          color="neutral"
          variant="outline"
          :size="compact ? 'sm' : 'md'"
          :class="compact ? 'min-w-0 flex-1' : 'max-w-60'"
        />
      </UDropdownMenu>
      <UButton
        icon="i-lucide-plus"
        :label="compact ? undefined : 'New widget'"
        color="neutral"
        variant="soft"
        :size="compact ? 'sm' : 'md'"
        :square="compact"
        aria-label="New widget"
        @click="openNew"
      />
    </div>

    <UModal
      v-model:open="nameModalOpen"
      :title="nameMode === 'new' ? 'New widget project' : 'Rename widget project'"
      :description="nameMode === 'new' ? 'Start visually or choose a working data example.' : 'Update the name shown in the project switcher.'"
      :ui="nameMode === 'new' ? { content: 'max-w-xl' } : undefined"
    >
      <template #body>
        <div v-if="nameMode === 'new'" class="divide-y divide-muted overflow-hidden border-y border-muted">
          <button
            v-for="starter in WIDGET_STARTERS"
            :key="starter.id"
            type="button"
            class="flex w-full items-center gap-3 border-l-2 border-l-transparent bg-default px-4 py-3 text-left outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            :class="selectedStarterId === starter.id ? 'border-l-primary bg-primary/10' : ''"
            :aria-pressed="selectedStarterId === starter.id"
            @click="selectStarter(starter.id)"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-md" :class="starter.accentClass">
              <UIcon :name="starter.icon" class="size-4.5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="text-sm font-semibold text-highlighted">{{ starter.name }}</span>
                <UBadge :label="starter.sourceLabel" color="neutral" variant="subtle" size="sm" />
              </span>
              <span class="mt-0.5 block text-xs leading-5 text-muted">{{ starter.description }}</span>
            </span>
            <UIcon
              :name="selectedStarterId === starter.id ? 'i-lucide-circle-check' : 'i-lucide-chevron-right'"
              class="size-4 shrink-0"
              :class="selectedStarterId === starter.id ? 'text-primary' : 'text-dimmed'"
            />
          </button>
        </div>

        <UFormField label="Project name" :class="nameMode === 'new' ? 'mt-5' : ''">
          <UInput v-model="nameDraft" :autofocus="nameMode === 'rename'" class="w-full" @keydown.enter="saveName" />
        </UFormField>
      </template>
      <template #footer="{ close }">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
        <UButton :label="nameMode === 'new' ? 'Create project' : 'Save name'" :disabled="!nameDraft.trim()" @click="saveName" />
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Delete project"
      :description="`Delete “${currentProject.name}” and its locally saved editor state?`"
    >
      <template #footer="{ close }">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
        <UButton label="Delete project" color="error" variant="solid" @click="confirmDelete" />
      </template>
    </UModal>
  </div>
</template>
