import type { EditorDocument } from '~/types/editor'

export interface WidgetProject {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  document: EditorDocument
}

export interface ProjectStoreState {
  version: 1
  activeProjectId: string
  projects: WidgetProject[]
}

export interface ProjectExport {
  format: 'scriptable-widget-studio-project'
  version: 1
  project: {
    name: string
    document: EditorDocument
  }
}
