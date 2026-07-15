import type {
  DataDiscoveryBundle,
  DataTransform,
  DataTransformOperation,
  WidgetDataSource
} from '~/types/editor'
import { getValueAtPath } from '~/utils/editor'

export const DATA_SOURCE_LABELS: Record<WidgetDataSource['kind'], string> = {
  'http-json': 'Web API',
  shortcut: 'Shortcuts',
  snapshot: 'Built-in values'
}

export const TRANSFORM_LABELS: Record<DataTransformOperation, string> = {
  copy: 'Copy value',
  number: 'Convert to number',
  count: 'Count items',
  sum: 'Sum values',
  first: 'First item',
  last: 'Last item',
  'days-until': 'Whole days until date',
  'hours-until': 'Remaining hours',
  'minutes-until': 'Remaining minutes'
}

const COUNTDOWN_DIVISORS: Partial<Record<DataTransformOperation, number>> = {
  'days-until': 86_400_000,
  'hours-until': 3_600_000,
  'minutes-until': 60_000
}

export function createDataSource(kind: WidgetDataSource['kind']): WidgetDataSource {
  if (kind === 'http-json') return { kind, url: '' }
  if (kind === 'shortcut') return { kind, updateMode: 'overwrite', appendKey: '' }
  return { kind: 'snapshot' }
}

export function normalizeSourceData(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { items: value }
  if (value && typeof value === 'object') return { ...(value as Record<string, unknown>) }
  return { value }
}

export function prepareSourceSample(value: unknown, source?: WidgetDataSource): Record<string, unknown> {
  if (source?.kind === 'shortcut' && source.updateMode === 'append') {
    if (!source.appendKey) return { items: [value] }
    const normalized = normalizeSourceData(value)
    if (Array.isArray(normalized[source.appendKey])) return normalized
    return { [source.appendKey]: [value] }
  }
  return normalizeSourceData(value)
}

export function applyDataTransforms(value: unknown, transforms: DataTransform[], source?: WidgetDataSource): Record<string, unknown> {
  const normalized = prepareSourceSample(value, source)
  const output = { ...normalized }

  transforms.forEach((transform) => {
    const outputKey = transform.outputKey.trim()
    if (!outputKey) return
    const sourceValue = getValueAtPath(normalized, transform.sourcePath)

    if (transform.operation === 'copy') {
      output[outputKey] = sourceValue
      return
    }

    if (transform.operation === 'number') {
      const numeric = Number(sourceValue)
      output[outputKey] = Number.isFinite(numeric) ? numeric : undefined
      return
    }

    if (transform.operation in COUNTDOWN_DIVISORS) {
      const target = new Date(sourceValue as string | number | Date).getTime()
      if (Number.isNaN(target)) {
        output[outputKey] = undefined
        return
      }
      const difference = Math.max(0, target - Date.now())
      if (transform.operation === 'days-until') output[outputKey] = Math.floor(difference / 86_400_000)
      if (transform.operation === 'hours-until') output[outputKey] = Math.floor((difference % 86_400_000) / 3_600_000)
      if (transform.operation === 'minutes-until') output[outputKey] = Math.floor((difference % 3_600_000) / 60_000)
      return
    }

    const collection = Array.isArray(sourceValue) ? sourceValue : []
    if (transform.operation === 'count') {
      output[outputKey] = collection.length
      return
    }
    if (transform.operation === 'first') {
      const item = collection[0]
      output[outputKey] = transform.valuePath ? getValueAtPath(item, transform.valuePath) : item
      return
    }
    if (transform.operation === 'last') {
      const item = collection.at(-1)
      output[outputKey] = transform.valuePath ? getValueAtPath(item, transform.valuePath) : item
      return
    }

    output[outputKey] = collection.reduce((total, item) => {
      const valueToAdd = transform.valuePath ? getValueAtPath(item, transform.valuePath) : item
      const numeric = Number(valueToAdd)
      return Number.isFinite(numeric) ? total + numeric : total
    }, 0)
  })

  return output
}

export function isDataDiscoveryBundle(value: unknown): value is DataDiscoveryBundle {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return candidate.format === 'scriptable-widget-data-snapshot'
    && candidate.version === 1
    && 'sample' in candidate
    && isWidgetDataSource(candidate.source)
}

export function isWidgetDataSource(value: unknown): value is WidgetDataSource {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (candidate.kind === 'http-json') return typeof candidate.url === 'string'
  if (candidate.kind === 'shortcut') {
    return ['overwrite', 'merge', 'append'].includes(String(candidate.updateMode))
      && typeof candidate.appendKey === 'string'
  }
  return candidate.kind === 'snapshot'
}

export function sanitizeDataSource(source: WidgetDataSource): WidgetDataSource {
  if (source.kind === 'http-json') return { kind: source.kind, url: source.url.trim() }
  if (source.kind === 'shortcut') {
    return {
      kind: source.kind,
      updateMode: source.updateMode,
      appendKey: source.appendKey.trim()
    }
  }
  return { kind: 'snapshot' }
}

export function generateUniversalDataProbeCode() {
  return `// Scriptable Data Probe
// Run directly for a public JSON URL or clipboard JSON.
// Run from Apple Shortcuts to inspect a Dictionary passed to Scriptable.

const DISCOVERY_FORMAT = "scriptable-widget-data-snapshot"

function parseJSON(value, message) {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(message)
  }
}

async function readSource() {
  if (args.shortcutParameter !== null && args.shortcutParameter !== undefined) {
    return {
      source: { kind: "shortcut", updateMode: "overwrite", appendKey: "" },
      sample: parseJSON(args.shortcutParameter, "Shortcut input must contain valid JSON.")
    }
  }

  const sourceAlert = new Alert()
  sourceAlert.title = "Sample widget data"
  sourceAlert.message = "Fetch a public JSON endpoint or inspect JSON already copied on this phone."
  sourceAlert.addAction("Fetch JSON URL")
  sourceAlert.addAction("Read clipboard JSON")
  sourceAlert.addCancelAction("Cancel")
  const sourceChoice = await sourceAlert.presentAlert()

  if (sourceChoice === 0) {
    const urlAlert = new Alert()
    urlAlert.title = "Public JSON URL"
    urlAlert.message = "The final widget will request this URL when it refreshes."
    urlAlert.addTextField("https://api.example.com/data")
    urlAlert.addAction("Fetch JSON")
    urlAlert.addCancelAction("Cancel")
    const urlChoice = await urlAlert.presentAlert()
    if (urlChoice === -1) throw new Error("Sampling cancelled.")
    const url = urlAlert.textFieldValue(0).trim()
    if (!/^https?:\\/\\//i.test(url)) throw new Error("Enter a complete HTTP or HTTPS URL.")
    const request = new Request(url)
    const sample = await request.loadJSON()
    return { source: { kind: "http-json", url }, sample }
  }

  if (sourceChoice === 1) {
    const clipboard = Pasteboard.pasteString()
    if (!clipboard) throw new Error("The clipboard does not contain text.")
    return {
      source: { kind: "snapshot" },
      sample: parseJSON(clipboard, "The clipboard does not contain valid JSON.")
    }
  }

  throw new Error("Sampling cancelled.")
}

async function main() {
  try {
    const result = await readSource()
    if (result.sample === null || result.sample === undefined) {
      throw new Error("The data source returned no value.")
    }
    const bundle = {
      format: DISCOVERY_FORMAT,
      version: 1,
      source: result.source,
      sample: result.sample,
      observedAt: new Date().toISOString()
    }
    const output = JSON.stringify(bundle, null, 2)
    Pasteboard.copyString(output)
    await QuickLook.present(output)
  } catch (error) {
    const alert = new Alert()
    alert.title = "Data sampling failed"
    alert.message = String(error && error.message ? error.message : error)
    alert.addAction("Done")
    await alert.presentAlert()
  }
  Script.complete()
}

await main()
`
}
