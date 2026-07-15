import type {
  DateProperties,
  EditorDocument,
  ImageProperties,
  NumberFormatOptions,
  PreviewSize,
  TextProperties,
  WidgetElement,
  WidgetProperties
} from '~/types/editor'
import { applyDataTransforms } from '~/utils/data'
import { getUsedVariablePaths, resolveIndexedPath } from '~/utils/bindings'
import { getValueAtPath, slugifyVariable } from '~/utils/editor'

function jsString(value: unknown) {
  return JSON.stringify(String(value ?? ''))
}

function identifier(value: string, fallback = 'value') {
  const safe = slugifyVariable(value).replace(/[^a-zA-Z0-9_$]/g, '') || fallback
  return /^\d/.test(safe) ? `_${safe}` : safe
}

function propertyAccess(base: string, path: string) {
  return path.split('.').filter(Boolean).reduce((expression, segment) => {
    if (/^\d+$/.test(segment)) return `${expression}?.[${segment}]`
    if (/^[a-zA-Z_$][\w$]*$/.test(segment)) return `${expression}?.${segment}`
    return `${expression}?.[${jsString(segment)}]`
  }, base)
}

function boundExpression(_document: EditorDocument, path: string, repeatIndex?: number) {
  if (!path) return 'undefined'
  return propertyAccess('data', resolveIndexedPath(path, repeatIndex))
}

function colorLine(target: string, property: string, value: string, indent = '') {
  const hex = (value || '#000000').replace('#', '')
  const rgb = `#${hex.slice(0, 6).padEnd(6, '0')}`
  const alpha = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  return `${indent}${target}.${property} = new Color(${jsString(rgb)}, ${Number(alpha.toFixed(3))})`
}

function fontExpression(font: string, weight: string, size: number) {
  if (font === 'serif') return `new Font("Georgia", ${size})`

  const weightPrefix = weight === 'ultralight' ? 'ultraLight' : weight
  const family = font === 'rounded'
    ? 'Rounded'
    : font === 'monospaced'
      ? 'Monospaced'
      : ''

  return `Font.${weightPrefix}${family}SystemFont(${size})`
}

function formatConfig(format: NumberFormatOptions) {
  return JSON.stringify({
    round: format.round,
    decimals: format.decimals,
    currency: format.currency,
    prefix: format.prefix,
    suffix: format.suffix,
    percentage: format.percentage,
    textCase: format.textCase,
    dateFormat: format.dateFormat,
    fallback: format.fallback
  })
}

function alignmentLine(target: string, alignment: string, kind: 'text' | 'stack', indent = '  ') {
  if (kind === 'text') {
    const method = alignment === 'center' ? 'centerAlignText' : alignment === 'trailing' ? 'rightAlignText' : 'leftAlignText'
    return `${indent}${target}.${method}()`
  }
  const method = alignment === 'center' ? 'centerAlignContent' : alignment === 'trailing' ? 'bottomAlignContent' : 'topAlignContent'
  return `${indent}${target}.${method}()`
}

function buildElementLines(document: EditorDocument, root: WidgetElement, indent = '  ') {
  const lines: string[] = []
  let counter = 0

  const build = (element: WidgetElement, parent: string, repeatIndex?: number) => {
    if (element.type === 'verticalStack' || element.type === 'horizontalStack') {
      const props = element.properties as import('~/types/editor').StackProperties
      const repeatCount = Math.max(1, Math.min(12, Math.round(props.repeatCount || 1)))

      for (let index = 0; index < repeatCount; index += 1) {
        const instanceIndex = repeatCount > 1 ? index : repeatIndex
        const variable = `${identifier(element.name, element.type)}${++counter}`
        lines.push(`${indent}const ${variable} = ${parent}.addStack()`)
        lines.push(`${indent}${variable}.${element.type === 'verticalStack' ? 'layoutVertically' : 'layoutHorizontally'}()`)
        lines.push(`${indent}${variable}.spacing = ${props.spacing}`)
        lines.push(`${indent}${variable}.setPadding(${props.padding}, ${props.padding}, ${props.padding}, ${props.padding})`)
        lines.push(`${indent}${variable}.cornerRadius = ${props.cornerRadius}`)
        lines.push(colorLine(variable, 'backgroundColor', props.backgroundColor, indent))
        lines.push(alignmentLine(variable, props.alignment, 'stack', indent))
        element.children.forEach(child => build(child, variable, instanceIndex))
      }
      return
    }

    const variable = `${identifier(element.name, element.type)}${++counter}`

    if (element.type === 'text') {
      const props = element.properties as TextProperties
      const content = props.contentMode === 'variable'
        ? `formatValue(${boundExpression(document, props.variable, repeatIndex)}, ${formatConfig(props.format)})`
        : jsString(props.content)
      lines.push(`${indent}const ${variable} = ${parent}.addText(String(${content}))`)
      lines.push(`${indent}${variable}.font = ${fontExpression(props.font, props.weight, props.fontSize)}`)
      lines.push(colorLine(variable, 'textColor', props.color, indent))
      lines.push(`${indent}${variable}.textOpacity = ${props.opacity}`)
      lines.push(`${indent}${variable}.lineLimit = ${props.lineLimit}`)
      lines.push(`${indent}${variable}.minimumScaleFactor = ${props.minimumScaleFactor}`)
      lines.push(alignmentLine(variable, props.alignment, 'text', indent))
      return
    }

    if (element.type === 'spacer') {
      const props = element.properties as import('~/types/editor').SpacerProperties
      lines.push(`${indent}${parent}.addSpacer(${props.mode === 'flexible' ? 'null' : props.size})`)
      return
    }

    if (element.type === 'image') {
      const props = element.properties as ImageProperties
      if (props.sourceType === 'remote') {
        const urlExpression = props.remoteMode === 'variable'
          ? `(${boundExpression(document, props.variable, repeatIndex)} || ${jsString(props.fallbackUrl)})`
          : jsString(props.remoteUrl)
        lines.push(`${indent}const ${variable}Url = String(${urlExpression} || "")`)
        lines.push(`${indent}let ${variable}Image = await loadRemoteImage(${variable}Url)`)
        lines.push(`${indent}if (!${variable}Image) ${variable}Image = SFSymbol.named("photo").image`)
        lines.push(`${indent}const ${variable} = ${parent}.addImage(${variable}Image)`)
      } else {
        lines.push(`${indent}const ${variable}Symbol = SFSymbol.named(${jsString(props.systemSymbol)})`)
        lines.push(`${indent}const ${variable} = ${parent}.addImage(${variable}Symbol.image)`)
      }
      lines.push(colorLine(variable, 'tintColor', props.tintColor, indent))
      lines.push(`${indent}${variable}.imageSize = new Size(${props.width}, ${props.height})`)
      lines.push(`${indent}${variable}.cornerRadius = ${props.cornerRadius}`)
      return
    }

    if (element.type === 'date') {
      const props = element.properties as DateProperties
      const rawExpression = props.sourceType === 'variable'
        ? boundExpression(document, props.variable, repeatIndex)
        : 'new Date().toISOString()'
      lines.push(`${indent}const ${variable}Raw = ${rawExpression}`)
      lines.push(`${indent}const ${variable}Date = new Date(${variable}Raw)`)
      lines.push(`${indent}let ${variable}`)
      lines.push(`${indent}if (Number.isNaN(${variable}Date.getTime())) {`)
      lines.push(`${indent}  ${variable} = ${parent}.addText(${jsString(props.fallback)})`)
      lines.push(`${indent}} else if (${props.relativeDate}) {`)
      lines.push(`${indent}  ${variable} = ${parent}.addDate(${variable}Date)`)
      lines.push(`${indent}  ${variable}.applyRelativeStyle()`)
      lines.push(`${indent}} else {`)
      lines.push(`${indent}  const formatter = new DateFormatter()`)
      lines.push(`${indent}  formatter.dateFormat = ${jsString(props.dateFormat)}`)
      lines.push(`${indent}  ${variable} = ${parent}.addText(formatter.string(${variable}Date))`)
      lines.push(`${indent}}`)
      lines.push(`${indent}${variable}.font = ${fontExpression(props.font, props.weight, props.fontSize)}`)
      lines.push(colorLine(variable, 'textColor', props.color, indent))
    }
  }

  root.children.forEach(child => build(child, 'widget'))
  return lines
}

const WIDGET_SIZES: PreviewSize[] = ['small', 'medium', 'large']

function setContractValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.').filter(Boolean)
  let current: Record<string, unknown> | unknown[] = target

  parts.forEach((part, index) => {
    const last = index === parts.length - 1
    const key: string | number = Array.isArray(current) && /^\d+$/.test(part) ? Number(part) : part

    if (last) {
      ;(current as any)[key] = value === undefined ? null : value
      return
    }

    const nextIsArray = /^\d+$/.test(parts[index + 1] || '')
    const existing = (current as any)[key]
    if (!existing || typeof existing !== 'object') (current as any)[key] = nextIsArray ? [] : {}
    current = (current as any)[key]
  })
}

function buildContractSample(paths: string[], data: Record<string, unknown>) {
  const sample: Record<string, unknown> = {}
  paths.forEach(path => setContractValue(sample, path, getValueAtPath(data, path)))
  return sample
}

function lineComment(value: string) {
  return value.split('\n').map(line => `// ${line}`.trimEnd()).join('\n')
}

function widgetLayoutBlock(document: EditorDocument, size: PreviewSize) {
  const root = document.layouts[size]
  const properties = root.properties as WidgetProperties
  const elementLines = buildElementLines(document, root, '    ')
  const backgroundImageExpression = properties.backgroundImageMode === 'variable'
    ? `(${boundExpression(document, properties.backgroundImageVariable)} || ${jsString(properties.backgroundImageFallbackUrl)})`
    : jsString(properties.backgroundImageUrl)
  const backgroundImageLines = properties.backgroundImageMode === 'none'
    ? ''
    : `    const backgroundImage = await loadRemoteImage(String(${backgroundImageExpression} || ""))\n    if (backgroundImage) widget.backgroundImage = backgroundImage\n`

  return `  if (family === ${jsString(size)}) {
    const widget = new ListWidget()
${colorLine('widget', 'backgroundColor', properties.backgroundColor, '    ')}
${backgroundImageLines}    widget.setPadding(${properties.padding}, ${properties.padding}, ${properties.padding}, ${properties.padding})
    widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)
${properties.tapUrl ? `    widget.url = ${jsString(properties.tapUrl)}\n` : ''}${elementLines.join('\n')}
    return widget
  }`
}

export function generateScriptableCode(document: EditorDocument) {
  const widget = document.layouts.medium.properties as WidgetProperties
  const sampleData = JSON.stringify(document.data.sampleData ?? {}, null, 2)
  const source = JSON.stringify(document.data.source)
  const transforms = JSON.stringify(document.data.transforms.map(({ outputKey, operation, sourcePath, valuePath }) => ({
    outputKey,
    operation,
    sourcePath,
    valuePath
  })))
  const enabledSizes = WIDGET_SIZES.filter(size => document.enabledSizes[size])
  const layoutBlocks = enabledSizes.map(size => widgetLayoutBlock(document, size))
  const previewData = applyDataTransforms(document.data.sampleData, document.data.transforms, document.data.source)
  const usedPaths = getUsedVariablePaths(document)
  const expectedFields = JSON.stringify(Object.fromEntries(usedPaths.map(path => [path, valueType(getValueAtPath(previewData, path))])))
  const contractSample = JSON.stringify(buildContractSample(usedPaths, previewData), null, 2)
  const contractDescription = usedPaths.length
    ? `Expected data shape:\n${contractSample}`
    : 'This widget is visual-only. It has no bound fields yet.'

  return `// WIDGET DATA CONNECTION
// Widget Studio owns the layout below. Connect any API, Shortcut, Scriptable API,
// local file, widget parameter, or custom JavaScript by editing loadWidgetData().
${lineComment(contractDescription)}
// Return null to keep using the source configured in Widget Studio.
async function loadWidgetData() {
  return null
}

// CONFIGURATION
const STORAGE_FILE_NAME = ${jsString(document.data.fileName || 'widget-data.json')}
const DATA_SOURCE = ${source}
const TRANSFORMS = ${transforms}
const EXPECTED_FIELDS = ${expectedFields}
const REFRESH_MINUTES = ${widget.refreshInterval}
const PREVIEW_FAMILY = ${jsString(document.activeSize)}
const ENABLED_WIDGET_FAMILIES = ${JSON.stringify(enabledSizes)}

// Captured data used for previews and as the final fallback.
const PREVIEW_DATA = ${sampleData}

// STORAGE
const Storage = {
  manager: FileManager.local(),

  path() {
    return this.manager.joinPath(this.manager.documentsDirectory(), STORAGE_FILE_NAME)
  },

  load() {
    const path = this.path()
    if (!this.manager.fileExists(path)) return null
    try {
      const stored = JSON.parse(this.manager.readString(path))
      if (stored?.format === "scriptable-widget-cache" && stored.version === 1) return stored.data
      return stored
    } catch {
      return null
    }
  },

  save(value) {
    const record = {
      format: "scriptable-widget-cache",
      version: 1,
      updatedAt: new Date().toISOString(),
      data: value
    }
    this.manager.writeString(this.path(), JSON.stringify(record, null, 2))
    return value
  },

  merge(value) {
    const current = this.load()
    const base = current && !Array.isArray(current) ? current : {}
    return this.save({ ...base, ...value })
  },

  append(value, collectionKey) {
    const current = this.load()
    const base = current && !Array.isArray(current) ? current : {}
    const items = collectionKey
      ? (Array.isArray(base[collectionKey]) ? [...base[collectionKey]] : [])
      : (Array.isArray(current) ? [...current] : [])
    const received = value && typeof value === "object" && !Array.isArray(value)
      ? { ...value, _receivedAt: new Date().toISOString() }
      : value
    const signature = value?.id ?? JSON.stringify(value)
    const duplicate = items.some(item => (item?.id ?? JSON.stringify(withoutTimestamps(item))) === signature)
    if (!duplicate) items.push(received)
    return collectionKey ? this.save({ ...base, [collectionKey]: items }) : this.save(items)
  },

  remove() {
    const path = this.path()
    if (this.manager.fileExists(path)) this.manager.remove(path)
  }
}

// EXECUTION MODE
function executionMode() {
  if (DATA_SOURCE.kind === "shortcut" && args.shortcutParameter !== null && args.shortcutParameter !== undefined) return "shortcut"
  if (config.runsInWidget) return "widget"
  return "preview"
}

// DATA HELPERS
function parseShortcutInput(input) {
  let value = input
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      throw new Error("Shortcut input must be valid JSON.")
    }
  }
  if (!value || typeof value !== "object") {
    throw new Error("Shortcut input must be a Dictionary, List, or JSON object.")
  }
  return value
}

function withoutTimestamps(value) {
  if (!value || typeof value !== "object") return value
  const { _receivedAt, _updatedAt, ...rest } = value
  return rest
}

function valueAtPath(value, path) {
  if (!path) return value
  return path.split(".").reduce((current, part) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) return current[Number(part)]
    if (typeof current === "object") return current[part]
    return undefined
  }, value)
}

function normalizeSourceData(value) {
  if (Array.isArray(value)) return { items: value }
  if (value && typeof value === "object") return { ...value }
  return { value }
}

async function loadRemoteImage(url) {
  if (!url) return null
  try {
    const request = new Request(String(url))
    return await request.loadImage()
  } catch (error) {
    console.warn("Could not load image: " + String(error && error.message ? error.message : error))
    return null
  }
}

function prepareCapturedData(value) {
  if (DATA_SOURCE.kind === "shortcut" && DATA_SOURCE.updateMode === "append") {
    if (!DATA_SOURCE.appendKey) return [value]
    const normalized = normalizeSourceData(value)
    if (Array.isArray(normalized[DATA_SOURCE.appendKey])) return normalized
    return { [DATA_SOURCE.appendKey]: [value] }
  }
  return value
}

function applyTransforms(value) {
  const normalized = normalizeSourceData(value)
  const output = { ...normalized }

  for (const transform of TRANSFORMS) {
    const outputKey = String(transform.outputKey || "").trim()
    if (!outputKey) continue
    const sourceValue = valueAtPath(normalized, transform.sourcePath)

    if (transform.operation === "copy") {
      output[outputKey] = sourceValue
      continue
    }

    if (transform.operation === "number") {
      const numeric = Number(sourceValue)
      output[outputKey] = Number.isFinite(numeric) ? numeric : undefined
      continue
    }

    if (["days-until", "hours-until", "minutes-until"].includes(transform.operation)) {
      const target = new Date(sourceValue).getTime()
      if (Number.isNaN(target)) {
        output[outputKey] = undefined
        continue
      }
      const difference = Math.max(0, target - Date.now())
      if (transform.operation === "days-until") output[outputKey] = Math.floor(difference / 86400000)
      else if (transform.operation === "hours-until") output[outputKey] = Math.floor((difference % 86400000) / 3600000)
      else output[outputKey] = Math.floor((difference % 3600000) / 60000)
      continue
    }

    const collection = Array.isArray(sourceValue) ? sourceValue : []
    if (transform.operation === "count") output[outputKey] = collection.length
    else if (transform.operation === "first") {
      const item = collection[0]
      output[outputKey] = transform.valuePath ? valueAtPath(item, transform.valuePath) : item
    }
    else if (transform.operation === "last") {
      const item = collection[collection.length - 1]
      output[outputKey] = transform.valuePath ? valueAtPath(item, transform.valuePath) : item
    }
    else if (transform.operation === "sum") {
      output[outputKey] = collection.reduce((total, item) => {
        const valueToAdd = transform.valuePath ? valueAtPath(item, transform.valuePath) : item
        const numeric = Number(valueToAdd)
        return Number.isFinite(numeric) ? total + numeric : total
      }, 0)
    }
  }

  return output
}

function valueType(value) {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function inspectBindings(data) {
  const issues = []
  for (const [path, expectedType] of Object.entries(EXPECTED_FIELDS)) {
    const value = valueAtPath(data, path)
    if (value === undefined) issues.push(path + " is missing")
    else if (expectedType !== "null" && valueType(value) !== expectedType) {
      issues.push(path + " changed from " + expectedType + " to " + valueType(value))
    }
  }
  if (issues.length) console.warn("Widget data contract changed: " + issues.join("; "))
}

async function loadSourceData() {
  const customData = await loadWidgetData()
  if (customData !== null && customData !== undefined) return customData
  if (DATA_SOURCE.kind === "snapshot") return PREVIEW_DATA
  if (DATA_SOURCE.kind === "shortcut") return Storage.load() ?? prepareCapturedData(PREVIEW_DATA)
  if (!/^https?:\\/\\//i.test(DATA_SOURCE.url || "")) {
    console.warn("The Web API source needs a complete HTTP or HTTPS URL. Using the captured sample.")
    return Storage.load() ?? PREVIEW_DATA
  }

  try {
    const request = new Request(DATA_SOURCE.url)
    const response = await request.loadJSON()
    Storage.save(response)
    return response
  } catch (error) {
    const cached = Storage.load()
    if (cached !== null && cached !== undefined) {
      console.warn("Using cached widget data: " + String(error && error.message ? error.message : error))
      return cached
    }
    console.warn("Using the captured sample: " + String(error && error.message ? error.message : error))
    return PREVIEW_DATA
  }
}

function formatValue(value, options) {
  if (value === null || value === undefined || value === "") return options.fallback || "—"
  let output = value
  if (typeof output === "number") {
    if (options.percentage) output *= 100
    output = options.round ? Math.round(output) : output.toFixed(options.decimals)
    if (options.percentage) output += "%"
  } else if (options.dateFormat) {
    const date = new Date(output)
    if (!Number.isNaN(date.getTime())) {
      const formatter = new DateFormatter()
      formatter.dateFormat = options.dateFormat
      output = formatter.string(date)
    }
  } else if (typeof output === "object") {
    output = JSON.stringify(output)
  }
  output = \`\${options.currency}\${options.prefix}\${output}\${options.suffix}\`
  if (options.textCase === "uppercase") return output.toUpperCase()
  if (options.textCase === "lowercase") return output.toLowerCase()
  return output
}

// SIZE-AWARE RENDERER
function renderDisabledWidget(family) {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#172033")
  widget.setPadding(16, 16, 16, 16)
  const label = family ? family.charAt(0).toUpperCase() + family.slice(1) : "This"
  const title = widget.addText(label + " layout disabled")
  title.font = Font.semiboldSystemFont(14)
  title.textColor = Color.white()
  widget.addSpacer(6)
  const detail = widget.addText("Enable this size in Widget Studio and export the script again.")
  detail.font = Font.systemFont(10)
  detail.textColor = new Color("#cbd5e1")
  return widget
}

async function renderWidget(data, family) {
${layoutBlocks.join('\n\n')}

  return renderDisabledWidget(family)
}

// ENTRY POINT
async function main() {
  const mode = executionMode()

  if (mode === "shortcut") {
    const input = parseShortcutInput(args.shortcutParameter)
    if (DATA_SOURCE.updateMode === "overwrite") Storage.save(input)
    else if (DATA_SOURCE.updateMode === "merge") Storage.merge(input)
    else Storage.append(input, DATA_SOURCE.appendKey)

    Script.setShortcutOutput({ ok: true, updatedAt: new Date().toISOString() })
    Script.complete()
    return
  }

  const rawData = await loadSourceData()
  const data = applyTransforms(rawData)
  inspectBindings(data)
  const requestedFamily = mode === "widget" ? config.widgetFamily : PREVIEW_FAMILY
  const family = requestedFamily === "extraLarge" ? "large" : requestedFamily
  const widget = await renderWidget(data || {}, family)

  if (mode === "widget") Script.setWidget(widget)
  else if (family === "small") await widget.presentSmall()
  else if (family === "large") await widget.presentLarge()
  else await widget.presentMedium()

  Script.complete()
}

await main()
`
}

function valueType(value: unknown) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
