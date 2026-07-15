import type { EditorDocument } from '~/types/editor'
import type { ProjectExport, ProjectStoreState, WidgetProject } from '~/types/project'
import { createDocument, createId, migrateEditorDocument } from '~/utils/editor'

const PROJECT_STORAGE_KEY = 'scriptable-widget-studio:projects:v1'

function createProject(name = 'Untitled widget', document = createDocument()): WidgetProject {
  const now = new Date().toISOString()
  return {
    id: createId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    document
  }
}

function createStore(): ProjectStoreState {
  const project = createProject()
  return { version: 1, activeProjectId: project.id, projects: [project] }
}

export function useProjectStore() {
  const state = useState<ProjectStoreState>('project-store', createStore)
  const hydrated = useState<boolean>('project-store-hydrated', () => false)
  const persistenceBound = useState<boolean>('project-store-persistence-bound', () => false)

  const currentProject = computed(() => (
    state.value.projects.find(project => project.id === state.value.activeProjectId)
      ?? state.value.projects[0]!
  ))

  const document = computed<EditorDocument>({
    get: () => currentProject.value.document,
    set: value => { currentProject.value.document = value }
  })

  function activateProject(id: string) {
    if (state.value.projects.some(project => project.id === id)) state.value.activeProjectId = id
  }

  function newProject(name = 'Untitled widget', sourceDocument = createDocument()) {
    const project = createProject(name, sourceDocument)
    state.value.projects.push(project)
    state.value.activeProjectId = project.id
    return project
  }

  function duplicateProject(id = currentProject.value.id) {
    const source = state.value.projects.find(project => project.id === id)
    if (!source) return
    const project = createProject(`${source.name} copy`, JSON.parse(JSON.stringify(source.document)) as EditorDocument)
    state.value.projects.push(project)
    state.value.activeProjectId = project.id
    return project
  }

  function renameProject(id: string, name: string) {
    const project = state.value.projects.find(item => item.id === id)
    if (!project || !name.trim()) return
    project.name = name.trim()
    project.updatedAt = new Date().toISOString()
  }

  function deleteProject(id: string) {
    const index = state.value.projects.findIndex(project => project.id === id)
    if (index < 0) return
    state.value.projects.splice(index, 1)
    if (!state.value.projects.length) state.value.projects.push(createProject())
    if (state.value.activeProjectId === id) {
      state.value.activeProjectId = state.value.projects[Math.min(index, state.value.projects.length - 1)]!.id
    }
  }

  function exportProject(id = currentProject.value.id) {
    const project = state.value.projects.find(item => item.id === id)
    if (!project) return ''
    const payload: ProjectExport = {
      format: 'scriptable-widget-studio-project',
      version: 1,
      project: {
        name: project.name,
        document: project.document
      }
    }
    return JSON.stringify(payload, null, 2)
  }

  function importProject(content: string) {
    const parsed = JSON.parse(content) as ProjectExport | EditorDocument | Record<string, any>
    const source = 'format' in parsed && parsed.format === 'scriptable-widget-studio-project'
      ? (parsed as ProjectExport).project
      : { name: 'Imported widget', document: parsed as EditorDocument }
    const document = migrateEditorDocument(source.document)
    if (!document) {
      throw new Error('This file is not a valid Scriptable Widget Studio project.')
    }

    const project = createProject(source.name, JSON.parse(JSON.stringify(document)) as EditorDocument)
    state.value.projects.push(project)
    state.value.activeProjectId = project.id
    return project
  }

  onMounted(() => {
    if (hydrated.value) return
    try {
      const saved = localStorage.getItem(PROJECT_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ProjectStoreState
        if (parsed?.version === 1 && parsed.projects?.length) {
          const projects = parsed.projects.map((project) => {
            const document = migrateEditorDocument(project.document)
            if (!document) throw new Error('Invalid saved project')
            return { ...project, document }
          })
          state.value = { ...parsed, projects }
        }
      }
    } catch {
      localStorage.removeItem(PROJECT_STORAGE_KEY)
    } finally {
      hydrated.value = true
    }
  })

  if (import.meta.client && !persistenceBound.value) {
    persistenceBound.value = true
    watch(state, (value) => {
      if (!hydrated.value) return
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(value))
    }, { deep: true })
  }

  return {
    state,
    currentProject,
    document,
    activateProject,
    newProject,
    duplicateProject,
    renameProject,
    deleteProject,
    exportProject,
    importProject
  }
}
