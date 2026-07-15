import type { ElementType, PreviewSize, WidgetProperties } from '~/types/editor'
import { getUsedVariablePaths } from '~/utils/bindings'
import { resolveIndexedPath } from '~/utils/bindings'
import { applyDataTransforms } from '~/utils/data'
import { cloneElement, createElement, findElement, findParent, getValueAtPath } from '~/utils/editor'

export function useWidgetEditor() {
  const { state: projectState, document } = useProjectStore()
  const selectedElementId = useState<string>('selected-element', () => document.value.layouts[document.value.activeSize].id)
  const activeLeftTab = useState<'structure' | 'json'>('active-left-tab', () => 'structure')
  const templatePickerOpen = useState<boolean>('template-picker-open', () => false)
  const canvasDraggingId = useState<string>('canvas-dragging-element', () => '')
  const canvasStackHandleId = useState<string>('canvas-stack-handle-element', () => '')
  const treeDraggingId = useState<string>('tree-dragging-element', () => '')
  const selectionBound = useState<boolean>('project-selection-bound', () => false)

  const activeSize = computed(() => document.value.activeSize)
  const activeRoot = computed(() => document.value.layouts[activeSize.value])
  const selectedElement = computed(() => findElement(activeRoot.value, selectedElementId.value) ?? activeRoot.value)
  const previewData = computed(() => applyDataTransforms(document.value.data.sampleData, document.value.data.transforms, document.value.data.source))
  const usedVariablePaths = computed(() => getUsedVariablePaths(document.value))
  const availableVariablePaths = computed(() => [...new Set([
    ...document.value.data.selectedPaths,
    ...usedVariablePaths.value
  ])].filter(path => getValueAtPath(previewData.value, path) !== undefined))
  const variableOptions = computed(() => availableVariablePaths.value.map(path => ({
    label: path,
    value: path,
    preview: getValueAtPath(previewData.value, path)
  })))

  if (import.meta.client && !selectionBound.value) {
    selectionBound.value = true
    watch(() => projectState.value.activeProjectId, () => {
      selectedElementId.value = document.value.layouts[document.value.activeSize].id
      activeLeftTab.value = 'structure'
      templatePickerOpen.value = false
      canvasDraggingId.value = ''
      canvasStackHandleId.value = ''
      treeDraggingId.value = ''
    })
  }

  function setActiveSize(size: PreviewSize) {
    document.value.activeSize = size
    selectedElementId.value = document.value.layouts[size].id
    activeLeftTab.value = 'structure'
  }

  function setSizeEnabled(size: PreviewSize, enabled: boolean) {
    const enabledCount = Object.values(document.value.enabledSizes).filter(Boolean).length
    if (!enabled && document.value.enabledSizes[size] && enabledCount === 1) return false
    document.value.enabledSizes[size] = enabled
    return true
  }

  function copyLayout(source: PreviewSize, target: PreviewSize) {
    const clone = cloneElement(document.value.layouts[source])
    clone.name = document.value.layouts[source].name
    ;(clone.properties as WidgetProperties).previewSize = target
    document.value.layouts[target] = clone
    document.value.enabledSizes[target] = true
    setActiveSize(target)
    return clone
  }

  function selectElement(id: string) {
    selectedElementId.value = id
    activeLeftTab.value = 'structure'
  }

  function openTemplatePicker() {
    activeLeftTab.value = 'structure'
    templatePickerOpen.value = true
  }

  function addElement(parentId: string, type: ElementType) {
    const parent = findElement(activeRoot.value, parentId)
    if (!parent || !['widget', 'verticalStack', 'horizontalStack'].includes(parent.type)) return
    const element = createElement(type)
    parent.children.push(element)
    parent.collapsed = false
    selectedElementId.value = element.id
  }

  function removeElement(id: string) {
    if (id === activeRoot.value.id) return
    const parent = findParent(activeRoot.value, id)
    if (!parent) return
    const index = parent.children.findIndex(child => child.id === id)
    if (index < 0) return
    parent.children.splice(index, 1)
    selectedElementId.value = parent.id
  }

  function duplicateElement(id: string) {
    const element = findElement(activeRoot.value, id)
    const parent = findParent(activeRoot.value, id)
    if (!element || !parent) return
    const index = parent.children.findIndex(child => child.id === id)
    const clone = cloneElement(element)
    parent.children.splice(index + 1, 0, clone)
    selectedElementId.value = clone.id
  }

  function moveElement(id: string, direction: -1 | 1) {
    const parent = findParent(activeRoot.value, id)
    if (!parent) return
    const index = parent.children.findIndex(child => child.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= parent.children.length) return
    const [element] = parent.children.splice(index, 1)
    if (element) parent.children.splice(target, 0, element)
  }

  function canMoveElementToParent(id: string, targetParentId: string) {
    if (id === activeRoot.value.id || id === targetParentId) return false
    const element = findElement(activeRoot.value, id)
    const targetParent = findElement(activeRoot.value, targetParentId)
    if (!element || !targetParent || !['widget', 'verticalStack', 'horizontalStack'].includes(targetParent.type)) return false
    return !findElement(element, targetParentId)
  }

  function moveElementToParent(id: string, targetParentId: string, targetIndex: number) {
    if (!canMoveElementToParent(id, targetParentId)) return false
    const sourceParent = findParent(activeRoot.value, id)
    const targetParent = findElement(activeRoot.value, targetParentId)
    if (!sourceParent || !targetParent) return false

    const sourceIndex = sourceParent.children.findIndex(child => child.id === id)
    if (sourceIndex < 0) return false
    if (sourceParent.id === targetParent.id && sourceIndex === targetIndex) return false

    const [element] = sourceParent.children.splice(sourceIndex, 1)
    if (!element) return false
    const insertionIndex = Math.max(0, Math.min(targetIndex, targetParent.children.length))
    targetParent.children.splice(insertionIndex, 0, element)
    targetParent.collapsed = false
    selectedElementId.value = element.id
    return true
  }

  function setSampleData(value: unknown) {
    document.value.data.sampleData = value
    const nextPreview = applyDataTransforms(value, document.value.data.transforms, document.value.data.source)
    document.value.data.selectedPaths = document.value.data.selectedPaths.filter(path => getValueAtPath(nextPreview, path) !== undefined)
  }

  function refreshDataBindings() {
    document.value.data.selectedPaths = document.value.data.selectedPaths.filter(path => getValueAtPath(previewData.value, path) !== undefined)
  }

  function toggleVariable(path: string, enabled?: boolean) {
    const paths = document.value.data.selectedPaths
    const exists = paths.includes(path)
    const shouldEnable = enabled ?? !exists
    if (!shouldEnable && usedVariablePaths.value.includes(path)) return false
    if (shouldEnable && !exists) paths.push(path)
    if (!shouldEnable && exists) paths.splice(paths.indexOf(path), 1)
    return true
  }

  function resolveVariable(path: string, repeatIndex?: number) {
    if (!path) return undefined
    return getValueAtPath(previewData.value, resolveIndexedPath(path, repeatIndex))
  }

  return {
    document,
    activeSize,
    activeRoot,
    selectedElementId,
    selectedElement,
    canvasDraggingId,
    canvasStackHandleId,
    treeDraggingId,
    activeLeftTab,
    templatePickerOpen,
    previewData,
    usedVariablePaths,
    variableOptions,
    setActiveSize,
    setSizeEnabled,
    copyLayout,
    selectElement,
    openTemplatePicker,
    addElement,
    removeElement,
    duplicateElement,
    moveElement,
    canMoveElementToParent,
    moveElementToParent,
    setSampleData,
    refreshDataBindings,
    toggleVariable,
    resolveVariable
  }
}
