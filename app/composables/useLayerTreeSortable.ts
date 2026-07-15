import Sortable from 'sortablejs'
import type { MoveEvent, SortableEvent } from 'sortablejs'
import { onBeforeUnmount, onMounted, toValue, type MaybeRefOrGetter } from 'vue'

export function useLayerTreeSortable(
  container: MaybeRefOrGetter<HTMLElement | null>,
  parentId: MaybeRefOrGetter<string>
) {
  const {
    treeDraggingId,
    canMoveElementToParent,
    moveElementToParent,
    selectElement
  } = useWidgetEditor()

  let sortable: Sortable | undefined
  let activeDropTarget: HTMLElement | undefined

  function elementId(event: Pick<SortableEvent, 'item'> | MoveEvent) {
    return 'dragged' in event
      ? event.dragged.dataset.layerElementId
      : event.item.dataset.layerElementId
  }

  function clearDropTarget() {
    activeDropTarget?.classList.remove('layer-drop-target')
    activeDropTarget = undefined
  }

  function setDropTarget(target: HTMLElement) {
    if (activeDropTarget === target) return
    clearDropTarget()
    activeDropTarget = target
    activeDropTarget.classList.add('layer-drop-target')
  }

  function handleStart(event: SortableEvent) {
    const id = elementId(event)
    if (!id) return
    treeDraggingId.value = id
    selectElement(id)
  }

  function handleMove(event: MoveEvent) {
    const id = elementId(event)
    const targetParentId = event.to.dataset.layerParentId
    if (!id || !targetParentId || !canMoveElementToParent(id, targetParentId)) {
      clearDropTarget()
      return false
    }
    setDropTarget(event.to)
    return true
  }

  function handleEnd(event: SortableEvent) {
    clearDropTarget()
    treeDraggingId.value = ''

    const id = elementId(event)
    const targetParentId = event.to.dataset.layerParentId
    const targetIndex = event.newDraggableIndex ?? event.newIndex
    if (!id || !targetParentId || targetIndex === undefined) return
    moveElementToParent(id, targetParentId, targetIndex)
  }

  onMounted(() => {
    const element = toValue(container)
    if (!element) return

    sortable = new Sortable(element, {
      animation: 160,
      group: { name: 'widget-layer-tree-elements', pull: true, put: true },
      draggable: '>[data-layer-sortable-item]',
      handle: '[data-layer-drag-handle]',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 4,
      emptyInsertThreshold: 22,
      ghostClass: 'layer-drag-ghost',
      chosenClass: 'layer-drag-chosen',
      dragClass: 'layer-drag-active',
      onStart: handleStart,
      onMove: handleMove,
      onEnd: handleEnd,
      onUnchoose: () => {
        clearDropTarget()
        treeDraggingId.value = ''
      }
    })
  })

  onBeforeUnmount(() => {
    clearDropTarget()
    sortable?.destroy()
  })
}
