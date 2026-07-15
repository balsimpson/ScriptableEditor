import Sortable from 'sortablejs'
import type { MoveEvent, SortableEvent } from 'sortablejs'
import { onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useCanvasSortable(
  container: MaybeRefOrGetter<HTMLElement | null>,
  parentId: MaybeRefOrGetter<string>,
  direction: MaybeRefOrGetter<'vertical' | 'horizontal'> = 'vertical'
) {
  const {
    canvasDraggingId,
    canvasStackHandleId,
    canMoveElementToParent,
    moveElementToParent,
    selectElement
  } = useWidgetEditor()

  let sortable: Sortable | undefined
  let activeDropTarget: HTMLElement | undefined

  function elementId(event: Pick<SortableEvent, 'item'> | MoveEvent) {
    return 'dragged' in event
      ? event.dragged.dataset.canvasElementId
      : event.item.dataset.canvasElementId
  }

  function clearDropTarget() {
    activeDropTarget?.classList.remove('canvas-drop-target')
    activeDropTarget = undefined
  }

  function setDropTarget(target: HTMLElement) {
    if (activeDropTarget === target) return
    clearDropTarget()
    activeDropTarget = target
    activeDropTarget.classList.add('canvas-drop-target')
  }

  function handleStart(event: SortableEvent) {
    const id = elementId(event)
    if (!id) return
    canvasDraggingId.value = id
    selectElement(id)
  }

  function handleMove(event: MoveEvent) {
    const id = elementId(event)
    const targetParentId = event.to.dataset.canvasParentId
    if (!id || !targetParentId || !canMoveElementToParent(id, targetParentId)) {
      clearDropTarget()
      return false
    }
    setDropTarget(event.to)
    return true
  }

  function handleEnd(event: SortableEvent) {
    clearDropTarget()
    canvasDraggingId.value = ''
    canvasStackHandleId.value = ''

    const id = elementId(event)
    const targetParentId = event.to.dataset.canvasParentId
    const targetIndex = event.newDraggableIndex ?? event.newIndex
    if (!id || !targetParentId || targetIndex === undefined) return
    moveElementToParent(id, targetParentId, targetIndex)
  }

  function bindSortable(element: HTMLElement) {
    sortable = new Sortable(element, {
      animation: 160,
      group: { name: 'widget-canvas-elements', pull: true, put: true },
      draggable: '>[data-canvas-sortable-item]',
      handle: '[data-canvas-drag-handle]',
      direction: toValue(direction),
      delay: 100,
      delayOnTouchOnly: true,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 4,
      emptyInsertThreshold: 18,
      ghostClass: 'canvas-drag-ghost',
      chosenClass: 'canvas-drag-chosen',
      dragClass: 'canvas-drag-active',
      onStart: handleStart,
      onMove: handleMove,
      onEnd: handleEnd,
      onUnchoose: () => {
        clearDropTarget()
        canvasDraggingId.value = ''
        canvasStackHandleId.value = ''
      }
    })
  }

  const stopWatchingContainer = watch(
    () => toValue(container),
    (element) => {
      sortable?.destroy()
      sortable = undefined
      if (element) bindSortable(element)
    },
    { immediate: true, flush: 'post' }
  )

  const stopWatchingStackHandle = watch(
    canvasStackHandleId,
    id => sortable?.option('disabled', id === toValue(parentId)),
    { flush: 'sync' }
  )

  onBeforeUnmount(() => {
    stopWatchingContainer()
    stopWatchingStackHandle()
    clearDropTarget()
    sortable?.destroy()
  })
}
