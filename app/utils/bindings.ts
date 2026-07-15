import type {
  DateProperties,
  EditorDocument,
  ImageProperties,
  PreviewSize,
  StackProperties,
  TextProperties,
  WidgetElement,
  WidgetProperties
} from '~/types/editor'
import { applyDataTransforms } from '~/utils/data'
import { getValueAtPath } from '~/utils/editor'

const WIDGET_SIZES: PreviewSize[] = ['small', 'medium', 'large']

export interface BindingIssue {
  size: PreviewSize
  elementId: string
  elementName: string
  elementType: WidgetElement['type']
  variable: string
}

export function resolveIndexedPath(path: string, repeatIndex?: number) {
  if (repeatIndex === undefined) return path
  return path.replaceAll('{index}', String(repeatIndex))
}

function walkElements(root: WidgetElement, visit: (element: WidgetElement, repeatIndex?: number) => void, repeatIndex?: number) {
  visit(root, repeatIndex)

  if (root.type === 'verticalStack' || root.type === 'horizontalStack') {
    const count = Math.max(1, Math.min(12, Math.round((root.properties as StackProperties).repeatCount || 1)))
    if (count > 1) {
      for (let index = 0; index < count; index += 1) {
        root.children.forEach(child => walkElements(child, visit, index))
      }
      return
    }
  }

  root.children.forEach(child => walkElements(child, visit, repeatIndex))
}

function variableBinding(element: WidgetElement) {
  if (element.type === 'widget') {
    const properties = element.properties as WidgetProperties
    return properties.backgroundImageMode === 'variable' ? properties.backgroundImageVariable : ''
  }
  if (element.type === 'text') {
    const properties = element.properties as TextProperties
    return properties.contentMode === 'variable' ? properties.variable : ''
  }
  if (element.type === 'image') {
    const properties = element.properties as ImageProperties
    return properties.sourceType === 'remote' && properties.remoteMode === 'variable' ? properties.variable : ''
  }
  if (element.type === 'date') {
    const properties = element.properties as DateProperties
    return properties.sourceType === 'variable' ? properties.variable : ''
  }
  return ''
}

export function getUsedVariablePaths(document: EditorDocument) {
  const paths = new Set<string>()
  WIDGET_SIZES.forEach((size) => {
    walkElements(document.layouts[size], (element, repeatIndex) => {
      const variable = variableBinding(element)
      if (variable) paths.add(resolveIndexedPath(variable, repeatIndex))
    })
  })
  return [...paths]
}

export function getBindingIssues(document: EditorDocument): BindingIssue[] {
  const data = applyDataTransforms(document.data.sampleData, document.data.transforms, document.data.source)
  const issues: BindingIssue[] = []

  WIDGET_SIZES.forEach((size) => {
    walkElements(document.layouts[size], (element, repeatIndex) => {
      const variable = variableBinding(element)
      const resolvedVariable = resolveIndexedPath(variable, repeatIndex)
      if (!resolvedVariable || getValueAtPath(data, resolvedVariable) !== undefined) return
      issues.push({
        size,
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        variable: resolvedVariable
      })
    })
  })

  return issues
}

export function hasBrokenBindings(document: EditorDocument) {
  return getBindingIssues(document).length > 0
}
