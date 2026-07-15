import type {
  EditorDocument,
  ElementType,
  JsonLeaf,
  NumberFormatOptions,
  PreviewSize,
  WidgetProperties,
  WidgetElement
} from '~/types/editor'

export const ELEMENT_LABELS: Record<ElementType, string> = {
  widget: 'Widget',
  verticalStack: 'Vertical stack',
  horizontalStack: 'Horizontal stack',
  spacer: 'Spacer',
  text: 'Text',
  image: 'Image',
  date: 'Date'
}

export const ELEMENT_ICONS: Record<ElementType, string> = {
  widget: 'i-lucide-layout-template',
  verticalStack: 'i-lucide-rows-3',
  horizontalStack: 'i-lucide-columns-3',
  spacer: 'i-lucide-move-horizontal',
  text: 'i-lucide-type',
  image: 'i-lucide-image',
  date: 'i-lucide-calendar-clock'
}

export const DEFAULT_FORMAT: NumberFormatOptions = {
  round: false,
  decimals: 0,
  currency: '',
  prefix: '',
  suffix: '',
  percentage: false,
  textCase: 'none',
  dateFormat: '',
  fallback: '—'
}

export function createId(prefix = 'item') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`
}

export function createElement(type: ElementType): WidgetElement {
  const common = {
    id: createId(type),
    type,
    name: ELEMENT_LABELS[type],
    children: [] as WidgetElement[]
  }

  switch (type) {
    case 'widget':
      return {
        ...common,
        properties: {
          backgroundColor: '#172033',
          backgroundOpacity: 1,
          backgroundImageMode: 'none',
          backgroundImageUrl: '',
          backgroundImageVariable: '',
          backgroundImageFallbackUrl: '',
          padding: 16,
          refreshInterval: 30,
          previewSize: 'medium',
          tapUrl: ''
        }
      }
    case 'verticalStack':
    case 'horizontalStack':
      return {
        ...common,
        properties: {
          alignment: 'leading',
          spacing: 8,
          backgroundColor: '#00000000',
          padding: 0,
          cornerRadius: 0,
          borderWidth: 0,
          borderColor: '#ffffff',
          repeatCount: 1
        }
      }
    case 'text':
      return {
        ...common,
        properties: {
          contentMode: 'static',
          content: 'Edit this text',
          variable: '',
          font: 'system',
          fontSize: 16,
          weight: 'semibold',
          color: '#ffffff',
          alignment: 'leading',
          opacity: 1,
          lineLimit: 1,
          minimumScaleFactor: 0.7,
          format: { ...DEFAULT_FORMAT }
        }
      }
    case 'image':
      return {
        ...common,
        properties: {
          sourceType: 'symbol',
          systemSymbol: 'sun.max.fill',
          remoteUrl: '',
          remoteMode: 'static',
          variable: '',
          fallbackUrl: '',
          width: 32,
          height: 32,
          tintColor: '#7dd3fc',
          cornerRadius: 8,
          opacity: 1,
          contentMode: 'fit'
        }
      }
    case 'date':
      return {
        ...common,
        properties: {
          dateFormat: 'EEE, MMM d',
          relativeDate: false,
          sourceType: 'now',
          variable: '',
          fallback: '—',
          color: '#cbd5e1',
          font: 'system',
          fontSize: 12,
          weight: 'medium'
        }
      }
    case 'spacer':
      return { ...common, properties: { mode: 'fixed', size: 8 } }
  }
}

export function createDocument(): EditorDocument {
  const layouts = Object.fromEntries((['small', 'medium', 'large'] as PreviewSize[]).map((size) => {
    const root = createElement('widget')
    ;(root.properties as WidgetProperties).previewSize = size
    return [size, root]
  })) as Record<PreviewSize, WidgetElement>

  return {
    version: 5,
    activeSize: 'medium',
    enabledSizes: { small: true, medium: true, large: true },
    layouts,
    data: {
      fileName: 'widget-data.json',
      selectedPaths: [],
      source: { kind: 'snapshot' },
      transforms: []
    }
  }
}

function isPreviewSize(value: unknown): value is PreviewSize {
  return value === 'small' || value === 'medium' || value === 'large'
}

function cloneLayoutForSize(source: WidgetElement, size: PreviewSize) {
  const clone = cloneElement(source)
  clone.name = source.name
  ;(clone.properties as WidgetProperties).previewSize = size
  return clone
}

export function migrateEditorDocument(value: unknown): EditorDocument | undefined {
  if (!value || typeof value !== 'object') return
  const candidate = value as Record<string, any>

  if (candidate.version === 5 || candidate.version === 4 || candidate.version === 3) {
    const layouts = candidate.layouts as Record<PreviewSize, WidgetElement> | undefined
    if (!layouts || !(['small', 'medium', 'large'] as PreviewSize[]).every(size => layouts[size]?.type === 'widget')) return

    const activeSize = isPreviewSize(candidate.activeSize) ? candidate.activeSize : 'medium'
    const enabledSizes = {
      small: candidate.enabledSizes?.small !== false,
      medium: candidate.enabledSizes?.medium !== false,
      large: candidate.enabledSizes?.large !== false
    }
    if (!Object.values(enabledSizes).some(Boolean)) enabledSizes.medium = true
    ;(['small', 'medium', 'large'] as PreviewSize[]).forEach((size) => {
      normalizeVisualProperties(layouts[size])
      ;(layouts[size].properties as WidgetProperties).previewSize = size
    })

    const legacyWidget = layouts.medium.properties as WidgetProperties & {
      storageMode?: 'overwrite' | 'merge' | 'append'
      appendKey?: string
    }
    const data = candidate.data && typeof candidate.data === 'object'
      ? candidate.data as Record<string, any>
      : {}
    const source = normalizeDataSource(data.source, legacyWidget)

    return {
      version: 5,
      activeSize,
      enabledSizes,
      layouts,
      data: {
        fileName: typeof data.fileName === 'string' && data.fileName ? data.fileName : 'widget-data.json',
        sampleData: data.sampleData,
        selectedPaths: Array.isArray(data.selectedPaths) ? data.selectedPaths.filter((path): path is string => typeof path === 'string') : [],
        source,
        transforms: normalizeTransforms(data.transforms),
        sampledAt: typeof data.sampledAt === 'string' ? data.sampledAt : undefined
      }
    }
  }

  if (candidate.version === 2 && candidate.root?.type === 'widget' && candidate.data) {
    const source = candidate.root as WidgetElement
    const sourceSize = isPreviewSize((source.properties as WidgetProperties).previewSize)
      ? (source.properties as WidgetProperties).previewSize
      : 'medium'
    const layouts = {} as Record<PreviewSize, WidgetElement>
    ;(['small', 'medium', 'large'] as PreviewSize[]).forEach((size) => {
      layouts[size] = size === sourceSize ? source : cloneLayoutForSize(source, size)
      normalizeVisualProperties(layouts[size])
      ;(layouts[size].properties as WidgetProperties).previewSize = size
    })

    return {
      version: 5,
      activeSize: sourceSize,
      enabledSizes: { small: true, medium: true, large: true },
      layouts,
      data: {
        fileName: typeof candidate.data.fileName === 'string' && candidate.data.fileName ? candidate.data.fileName : 'widget-data.json',
        sampleData: candidate.data.sampleData,
        selectedPaths: Array.isArray(candidate.data.selectedPaths) ? candidate.data.selectedPaths : [],
        source: normalizeDataSource(undefined, source.properties as WidgetProperties & {
          storageMode?: 'overwrite' | 'merge' | 'append'
          appendKey?: string
        }),
        transforms: []
      }
    }
  }
}

function normalizeVisualProperties(element: WidgetElement) {
  if (element.type === 'widget') {
    const properties = element.properties as WidgetProperties
    const backgroundOpacity = Number(properties.backgroundOpacity)
    properties.backgroundOpacity = Number.isFinite(backgroundOpacity)
      ? Math.max(0, Math.min(1, backgroundOpacity))
      : 1
    properties.backgroundImageMode = properties.backgroundImageMode === 'static' || properties.backgroundImageMode === 'variable'
      ? properties.backgroundImageMode
      : 'none'
    properties.backgroundImageUrl = typeof properties.backgroundImageUrl === 'string' ? properties.backgroundImageUrl : ''
    properties.backgroundImageVariable = typeof properties.backgroundImageVariable === 'string' ? properties.backgroundImageVariable : ''
    properties.backgroundImageFallbackUrl = typeof properties.backgroundImageFallbackUrl === 'string' ? properties.backgroundImageFallbackUrl : ''
  }

  if (element.type === 'verticalStack' || element.type === 'horizontalStack') {
    const properties = element.properties as import('~/types/editor').StackProperties
    const repeatCount = Number(properties.repeatCount)
    properties.repeatCount = Number.isFinite(repeatCount) ? Math.max(1, Math.min(12, Math.round(repeatCount))) : 1
  }

  element.children.forEach(normalizeVisualProperties)
}

function normalizeDataSource(
  value: unknown,
  legacyWidget?: WidgetProperties & { storageMode?: 'overwrite' | 'merge' | 'append', appendKey?: string }
): EditorDocument['data']['source'] {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    if (candidate.kind === 'http-json') {
      return { kind: 'http-json', url: typeof candidate.url === 'string' ? candidate.url : '' }
    }
    if (candidate.kind === 'shortcut') {
      const updateMode = candidate.updateMode === 'merge' || candidate.updateMode === 'append' ? candidate.updateMode : 'overwrite'
      return {
        kind: 'shortcut',
        updateMode,
        appendKey: typeof candidate.appendKey === 'string' ? candidate.appendKey : ''
      }
    }
    if (candidate.kind === 'snapshot') return { kind: 'snapshot' }
  }

  return {
    kind: 'shortcut',
    updateMode: legacyWidget?.storageMode ?? 'overwrite',
    appendKey: legacyWidget?.appendKey ?? ''
  }
}

function normalizeTransforms(value: unknown): EditorDocument['data']['transforms'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    const operation = candidate.operation
    if (![
      'copy', 'number', 'count', 'sum', 'first', 'last',
      'days-until', 'hours-until', 'minutes-until'
    ].includes(String(operation))) return []
    if (typeof candidate.outputKey !== 'string' || typeof candidate.sourcePath !== 'string') return []
    return [{
      id: typeof candidate.id === 'string' ? candidate.id : createId('transform'),
      outputKey: candidate.outputKey,
      operation: operation as EditorDocument['data']['transforms'][number]['operation'],
      sourcePath: candidate.sourcePath,
      valuePath: typeof candidate.valuePath === 'string' ? candidate.valuePath : ''
    }]
  })
}

export function findElement(root: WidgetElement, id: string): WidgetElement | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = findElement(child, id)
    if (found) return found
  }
}

export function findParent(root: WidgetElement, id: string): WidgetElement | undefined {
  if (root.children.some(child => child.id === id)) return root
  for (const child of root.children) {
    const parent = findParent(child, id)
    if (parent) return parent
  }
}

export function cloneElement(element: WidgetElement): WidgetElement {
  const clone = JSON.parse(JSON.stringify(element)) as WidgetElement
  const refreshIds = (node: WidgetElement) => {
    node.id = createId(node.type)
    node.children.forEach(refreshIds)
  }
  refreshIds(clone)
  clone.name = `${clone.name} copy`
  return clone
}

export function getValueAtPath(value: unknown, path: string): unknown {
  if (!path) return value
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) return current[Number(part)]
    if (typeof current === 'object') return (current as Record<string, unknown>)[part]
    return undefined
  }, value)
}

export function flattenJson(value: unknown, path = '', depth = 0): JsonLeaf[] {
  if (depth > 5) return []
  if (value === null || typeof value !== 'object') {
    return path ? [{ path, value, type: value === null ? 'null' : typeof value }] : []
  }

  const entries = Array.isArray(value)
    ? value.slice(0, 3).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>)

  return entries.flatMap(([key, child]) => flattenJson(child, path ? `${path}.${key}` : key, depth + 1))
}

export function slugifyVariable(value: string) {
  const cleaned = value
    .replace(/\[(\d+)\]/g, '_$1')
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, char: string | undefined) => char ? char.toUpperCase() : '')
    .replace(/^[A-Z]/, char => char.toLowerCase())
  return cleaned || 'value'
}

export function formatPreviewValue(value: unknown, format: NumberFormatOptions): string {
  if (value === undefined || value === null || value === '') return format.fallback || '—'
  let output: string

  if (typeof value === 'number') {
    let numeric = format.percentage ? value * 100 : value
    if (format.round) numeric = Math.round(numeric)
    output = format.round
      ? String(numeric)
      : numeric.toFixed(Math.max(0, Math.min(8, format.decimals)))
    if (format.percentage) output += '%'
  } else if (format.dateFormat && (typeof value === 'string' || typeof value === 'number')) {
    const date = new Date(value)
    output = Number.isNaN(date.getTime()) ? String(value) : formatDatePattern(date, format.dateFormat)
  } else {
    output = typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  output = `${format.currency}${format.prefix}${output}${format.suffix}`
  if (format.textCase === 'uppercase') return output.toUpperCase()
  if (format.textCase === 'lowercase') return output.toLowerCase()
  return output
}

export function formatDatePattern(date: Date, pattern: string) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const values: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    EEE: weekdays[date.getDay()] || '',
    MMM: months[date.getMonth()] || '',
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    dd: String(date.getDate()).padStart(2, '0'),
    d: String(date.getDate()),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0')
  }
  return pattern.replace(/yyyy|EEE|MMM|MM|dd|HH|mm|d/g, token => values[token] ?? token)
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
