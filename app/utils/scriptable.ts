import type {
  DateProperties,
  EditorDocument,
  ImageProperties,
  NumberFormatOptions,
  PreviewSize,
  StackProperties,
  TextProperties,
  WidgetElement,
  WidgetProperties
} from '~/types/editor'
import { applyDataTransforms } from '~/utils/data'
import { getBindingContracts, getBindingIssues, getUsedVariablePaths, resolveIndexedPath } from '~/utils/bindings'
import { getValueAtPath, slugifyVariable } from '~/utils/editor'

function jsString(value: unknown) {
  return JSON.stringify(String(value ?? ''))
}

function identifier(value: string, fallback = 'value') {
  const safe = slugifyVariable(value).replace(/[^a-zA-Z0-9_$]/g, '') || fallback
  return /^\d/.test(safe) ? `_${safe}` : safe
}

function boundExpression(_document: EditorDocument, path: string, repeatIndex?: number) {
  if (!path) return 'undefined'
  return `valueAtPath(data, ${jsString(resolveIndexedPath(path, repeatIndex))})`
}

function colorLine(target: string, property: string, value: string, indent = '', opacity = 1) {
  const dynamic = /^dynamic\((#[0-9a-fA-F]{6,8}),(#[0-9a-fA-F]{6,8})\)$/.exec(value || '')
  if (dynamic) {
    const color = (hexValue: string) => {
      const hex = hexValue.replace('#', '')
      const rgb = `#${hex.slice(0, 6)}`
      const sourceAlpha = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return `new Color(${jsString(rgb)}, ${Number((sourceAlpha * Math.max(0, Math.min(1, opacity))).toFixed(3))})`
    }
    return `${indent}${target}.${property} = Color.dynamic(${color(dynamic[1]!)}, ${color(dynamic[2]!)})`
  }
  const hex = (value || '#000000').replace('#', '')
  const rgb = `#${hex.slice(0, 6).padEnd(6, '0')}`
  const sourceAlpha = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  const alpha = sourceAlpha * Math.max(0, Math.min(1, opacity))
  return `${indent}${target}.${property} = new Color(${jsString(rgb)}, ${Number(alpha.toFixed(3))})`
}

function colorStringExpression(value: string) {
  const dynamic = /^dynamic\((#[0-9a-fA-F]{6,8}),(#[0-9a-fA-F]{6,8})\)$/.exec(value || '')
  return dynamic
    ? `(Device.isUsingDarkAppearance() ? ${jsString(dynamic[2])} : ${jsString(dynamic[1])})`
    : jsString(value)
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
    fallback: format.fallback,
    compact: format.compact
  })
}

function textAlignmentLine(target: string, alignment: string, indent = '  ') {
  const method = alignment === 'center' ? 'centerAlignText' : alignment === 'trailing' ? 'rightAlignText' : 'leftAlignText'
  return `${indent}${target}.${method}()`
}

function buildElementLines(document: EditorDocument, root: WidgetElement, indent = '  ') {
  const lines: string[] = []
  let counter = 0

  const build = (
    element: WidgetElement,
    parent: string,
    repeatIndex?: number,
    parentType: WidgetElement['type'] = 'widget',
    location: string[] = []
  ) => {
    if (element.type === 'verticalStack' || element.type === 'horizontalStack') {
      const props = element.properties as StackProperties
      const repeatCount = Math.max(1, Math.min(12, Math.round(props.repeatCount || 1)))

      for (let index = 0; index < repeatCount; index += 1) {
        const instanceIndex = repeatCount > 1 ? index : repeatIndex
        const variable = `${identifier(element.name, element.type)}${++counter}`
        const childLocation = [...location, element.name]
        const hasFlexibleSpacer = element.children.some(child => child.type === 'spacer' && (child.properties as import('~/types/editor').SpacerProperties).mode === 'flexible')
        lines.push(`${indent}const ${variable} = ${parent}.addStack()`)
        lines.push(`${indent}${variable}.${element.type === 'verticalStack' ? 'layoutVertically' : 'layoutHorizontally'}()`)
        lines.push(`${indent}${variable}.spacing = ${props.spacing}`)
        lines.push(`${indent}${variable}.setPadding(${props.padding}, ${props.padding}, ${props.padding}, ${props.padding})`)
        lines.push(`${indent}${variable}.cornerRadius = ${props.cornerRadius}`)
        lines.push(colorLine(variable, 'backgroundColor', props.backgroundColor, indent))
        lines.push(`${indent}${variable}.borderWidth = ${props.borderWidth}`)
        lines.push(colorLine(variable, 'borderColor', props.borderColor, indent))

        if (element.type === 'horizontalStack') {
          lines.push(`${indent}${variable}.centerAlignContent()`)
          if (!hasFlexibleSpacer && (props.alignment === 'center' || props.alignment === 'trailing')) {
            lines.push(`${indent}${variable}.addSpacer()`)
          }
          element.children.forEach(child => build(child, variable, instanceIndex, element.type, childLocation))
          if (!hasFlexibleSpacer && props.alignment === 'center') lines.push(`${indent}${variable}.addSpacer()`)
        } else if (props.alignment === 'leading') {
          element.children.forEach(child => build(child, variable, instanceIndex, element.type, childLocation))
        } else {
          element.children.forEach((child) => {
            if (child.type === 'spacer') {
              build(child, variable, instanceIndex, element.type, childLocation)
              return
            }
            const alignmentRow = `${identifier(element.name, 'alignment')}Alignment${++counter}`
            lines.push(`${indent}const ${alignmentRow} = ${variable}.addStack()`)
            lines.push(`${indent}${alignmentRow}.layoutHorizontally()`)
            lines.push(`${indent}${alignmentRow}.centerAlignContent()`)
            lines.push(`${indent}${alignmentRow}.addSpacer()`)
            build(child, alignmentRow, instanceIndex, 'horizontalStack', childLocation)
            if (props.alignment === 'center') lines.push(`${indent}${alignmentRow}.addSpacer()`)
          })
        }
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
      lines.push(textAlignmentLine(variable, props.alignment, indent))
      return
    }

    if (element.type === 'spacer') {
      const props = element.properties as import('~/types/editor').SpacerProperties
      lines.push(`${indent}${parent}.addSpacer(${props.mode === 'flexible' ? 'null' : props.size})`)
      return
    }

    if (element.type === 'image') {
      const props = element.properties as ImageProperties
      const elementLocation = [...location, element.name].join(' > ')
      if (props.sourceType === 'remote') {
        const urlExpression = props.remoteMode === 'variable'
          ? `(${boundExpression(document, props.variable, repeatIndex)} || ${jsString(props.fallbackUrl)})`
          : jsString(props.remoteUrl)
        lines.push(`${indent}const ${variable}Url = String(${urlExpression} || "")`)
        lines.push(`${indent}let ${variable}Image = await loadRemoteImage(${variable}Url, ${jsString(elementLocation)})`)
        lines.push(`${indent}if (!${variable}Image) ${variable}Image = requireSystemSymbol("photo", ${jsString(elementLocation)}).image`)
        lines.push(`${indent}const ${variable} = ${parent}.addImage(${variable}Image)`)
      } else {
        lines.push(`${indent}const ${variable}Symbol = requireSystemSymbol(${jsString(props.systemSymbol)}, ${jsString(elementLocation)})`)
        lines.push(`${indent}${variable}Symbol.applyFont(Font.systemFont(${Math.max(props.width, props.height)}))`)
        lines.push(`${indent}const ${variable} = ${parent}.addImage(${variable}Symbol.image)`)
        lines.push(colorLine(variable, 'tintColor', props.tintColor, indent))
      }
      lines.push(`${indent}${variable}.imageSize = new Size(${props.width}, ${props.height})`)
      lines.push(`${indent}${variable}.imageOpacity = ${props.opacity}`)
      lines.push(`${indent}${variable}.cornerRadius = ${props.cornerRadius}`)
      lines.push(`${indent}${variable}.${props.contentMode === 'fill' ? 'applyFillingContentMode' : 'applyFittingContentMode'}()`)
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

  root.children.forEach(child => build(child, 'widget', undefined, 'widget', []))
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

export interface ScriptableExportIssue {
  code: string
  severity: 'error' | 'warning'
  title: string
  description: string
  fix: string
  size?: PreviewSize
  elementId?: string
  location?: string
}

export interface ScriptableGenerationOptions {
  projectId?: string
  projectName?: string
}

function isCompleteHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isSupportedTapUrl(value: string) {
  if (!value) return true
  try {
    return Boolean(new URL(value).protocol)
  } catch {
    return false
  }
}

function isSafeCacheFileName(value: string) {
  const name = value.trim()
  return Boolean(name)
    && !name.includes('/')
    && !name.includes('\\')
    && name !== '.'
    && name !== '..'
    && !name.includes('..')
}

function normalizedCacheFileName(value: string) {
  const base = value.trim().split(/[\\/]/).at(-1) || 'widget-data.json'
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^-+|-+$/g, '') || 'widget-data.json'
  return safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`
}

function walkExportElements(root: WidgetElement, visit: (element: WidgetElement, ancestors: string[]) => void, ancestors: string[] = []) {
  visit(root, ancestors)
  const nextAncestors = root.type === 'widget' ? ancestors : [...ancestors, root.name]
  root.children.forEach(child => walkExportElements(child, visit, nextAncestors))
}

export function getScriptableExportIssues(document: EditorDocument): ScriptableExportIssue[] {
  const issues: ScriptableExportIssue[] = []
  const enabledSizes = WIDGET_SIZES.filter(size => document.enabledSizes[size])

  if (!enabledSizes.length) {
    issues.push({
      code: 'EXPORT-001',
      severity: 'error',
      title: 'No widget size is included',
      description: 'The downloaded script would have no Home Screen layout to render.',
      fix: 'Enable Small, Medium, or Large in Widget Studio before exporting.'
    })
  }

  if (!isSafeCacheFileName(document.data.fileName || '')) {
    issues.push({
      code: 'CACHE-001',
      severity: 'error',
      title: 'Cache file name is unsafe',
      description: 'Use a file name only, without folders, slashes, or repeated dots.',
      fix: 'Open any widget layout > Shared behavior > Cache file name and enter a name such as widget-data.json.'
    })
  }

  if (document.data.source.kind === 'http-json' && !isCompleteHttpUrl(document.data.source.url)) {
    issues.push({
      code: 'HTTP-001',
      severity: 'error',
      title: 'Web API URL is incomplete',
      description: document.data.source.url ? `Cannot request ${document.data.source.url}.` : 'No Web API URL has been configured.',
      fix: 'Open Data > Web API and enter a complete http:// or https:// JSON endpoint.'
    })
  }

  getBindingIssues(document).forEach((binding) => {
    issues.push({
      code: 'DATA-001',
      severity: 'warning',
      title: `Missing sample field: ${binding.variable}`,
      description: `${binding.location} cannot resolve this field in the current sample.`,
      fix: `Open Data and provide ${binding.variable}, or select ${binding.elementName} and change its data field.`,
      size: binding.size,
      elementId: binding.elementId,
      location: binding.location
    })
  })

  enabledSizes.forEach((size) => {
    const root = document.layouts[size]
    const rootProperties = root.properties as WidgetProperties
    const sizeLabel = size.charAt(0).toUpperCase() + size.slice(1)

    if (rootProperties.backgroundImageMode === 'static' && !isCompleteHttpUrl(rootProperties.backgroundImageUrl)) {
      issues.push({
        code: 'IMAGE-001',
        severity: 'error',
        title: `${sizeLabel} background image URL is invalid`,
        description: 'A static background image needs a complete HTTP or HTTPS URL.',
        fix: `Open the ${sizeLabel} widget layout > Background image and correct the URL.`,
        size,
        elementId: root.id,
        location: `${sizeLabel} > Widget`
      })
    }

    if (!isSupportedTapUrl(rootProperties.tapUrl)) {
      issues.push({
        code: 'URL-001',
        severity: 'warning',
        title: 'Tap URL may not open',
        description: `${rootProperties.tapUrl} does not contain a URL scheme.`,
        fix: 'Open any widget layout > Shared behavior > Tap URL and enter a complete URL.',
        size,
        elementId: root.id,
        location: `${sizeLabel} > Widget`
      })
    }

    walkExportElements(root, (element, ancestors) => {
      const location = [sizeLabel, ...ancestors, element.name].join(' > ')
      if (element.type === 'text') {
        const properties = element.properties as TextProperties
        if (properties.contentMode === 'variable' && !properties.variable.trim()) {
          issues.push({ code: 'DATA-002', severity: 'error', title: 'Text data field is empty', description: `${location} is set to Variable without a field.`, fix: `Select ${element.name} and choose a data field.`, size, elementId: element.id, location })
        }
      }
      if (element.type === 'date') {
        const properties = element.properties as DateProperties
        if (properties.sourceType === 'variable' && !properties.variable.trim()) {
          issues.push({ code: 'DATA-003', severity: 'error', title: 'Date data field is empty', description: `${location} is set to Data field without a field.`, fix: `Select ${element.name} and choose a date field.`, size, elementId: element.id, location })
        }
      }
      if (element.type === 'image') {
        const properties = element.properties as ImageProperties
        if (properties.sourceType === 'symbol' && !properties.systemSymbol.trim()) {
          issues.push({ code: 'SYMBOL-001', severity: 'error', title: 'SF Symbol name is empty', description: `${location} has no symbol name.`, fix: `Select ${element.name} and enter a valid SF Symbol name.`, size, elementId: element.id, location })
        }
        if (properties.sourceType === 'remote' && properties.remoteMode === 'static' && !isCompleteHttpUrl(properties.remoteUrl)) {
          issues.push({ code: 'IMAGE-002', severity: 'error', title: 'Remote image URL is invalid', description: `${location} needs a complete HTTP or HTTPS URL.`, fix: `Select ${element.name} and correct its Remote image URL.`, size, elementId: element.id, location })
        }
        if (properties.sourceType === 'remote' && properties.remoteMode === 'variable' && !properties.variable.trim()) {
          issues.push({ code: 'IMAGE-003', severity: 'error', title: 'Image data field is empty', description: `${location} is set to Data field without a field.`, fix: `Select ${element.name} and choose an image URL field.`, size, elementId: element.id, location })
        }
      }
    })
  })

  return issues
}

function widgetLayoutBlock(document: EditorDocument, size: PreviewSize) {
  const root = document.layouts[size]
  const properties = root.properties as WidgetProperties
  const elementLines = buildElementLines(document, root, '    ')
  const backgroundImageExpression = properties.backgroundImageMode === 'variable'
    ? `(${boundExpression(document, properties.backgroundImageVariable)} || ${jsString(properties.backgroundImageFallbackUrl)})`
    : jsString(properties.backgroundImageUrl)
  const backgroundOpacity = Math.max(0, Math.min(1, properties.backgroundOpacity ?? 1))
  const hasBackgroundImage = properties.backgroundImageMode !== 'none'
  const hasPartialBackgroundImage = hasBackgroundImage && backgroundOpacity > 0 && backgroundOpacity < 1
  const backgroundImageLines = properties.backgroundImageMode === 'none' || backgroundOpacity === 0
    ? ''
    : hasPartialBackgroundImage
      ? `    const backgroundImage = await loadRemoteImage(String(${backgroundImageExpression} || ""), ${jsString(`${size.charAt(0).toUpperCase() + size.slice(1)} > Widget background`)})\n    const visibleBackgroundImage = await imageWithOpacity(backgroundImage, ${Number(backgroundOpacity.toFixed(3))}, ${colorStringExpression(properties.backgroundColor)})\n    if (visibleBackgroundImage) widget.backgroundImage = visibleBackgroundImage\n    else ${colorLine('widget', 'backgroundColor', properties.backgroundColor, '', backgroundOpacity)}\n`
      : `    const backgroundImage = await loadRemoteImage(String(${backgroundImageExpression} || ""), ${jsString(`${size.charAt(0).toUpperCase() + size.slice(1)} > Widget background`)})\n    if (backgroundImage) widget.backgroundImage = backgroundImage\n`

  return `  if (family === ${jsString(size)}) {
    const widget = new ListWidget()
${colorLine('widget', 'backgroundColor', properties.backgroundColor, '    ', hasPartialBackgroundImage ? 0 : backgroundOpacity)}
${backgroundImageLines}    widget.setPadding(${properties.padding}, ${properties.padding}, ${properties.padding}, ${properties.padding})
    widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)
${properties.tapUrl ? `    widget.url = ${jsString(properties.tapUrl)}\n` : ''}${elementLines.join('\n')}
    appendRuntimeStatus(widget, runtimeStatus)
    return widget
  }`
}

export function generateScriptableCode(document: EditorDocument, options: ScriptableGenerationOptions = {}) {
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
  const expectedFields = JSON.stringify(getBindingContracts(document).map(contract => ({
    path: contract.variable,
    expectedType: getValueAtPath(previewData, contract.variable) === undefined
      ? 'present value'
      : valueType(getValueAtPath(previewData, contract.variable)),
    location: contract.location
  })))
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
const STORAGE_FILE_NAME = ${jsString(normalizedCacheFileName(document.data.fileName || 'widget-data.json'))}
const STORAGE_NAMESPACE = ${jsString(options.projectId || options.projectName || '')}
const DATA_SOURCE = ${source}
const TRANSFORMS = ${transforms}
const EXPECTED_FIELDS = ${expectedFields}
const REFRESH_MINUTES = ${widget.refreshInterval}
const PREVIEW_FAMILY = ${jsString(document.activeSize)}
const ENABLED_WIDGET_FAMILIES = ${JSON.stringify(enabledSizes)}

// Captured data used for previews and as the final fallback.
const PREVIEW_DATA = ${sampleData}

// DIAGNOSTICS
const RUNTIME_WARNINGS = []

function createDiagnostic(code, stage, message, fix, details) {
  return {
    code,
    stage,
    message,
    fix,
    location: details && details.location ? details.location : "",
    path: details && details.path ? details.path : "",
    expected: details && details.expected ? details.expected : "",
    received: details && details.received ? details.received : "",
    source: details && details.source ? details.source : ""
  }
}

function diagnosticError(problem) {
  const error = new Error(problem.message)
  error.diagnostic = problem
  return error
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error)
}

function normalizeDiagnostic(error, fallback) {
  if (error && error.diagnostic) return error.diagnostic
  return createDiagnostic(
    fallback && fallback.code ? fallback.code : "RUNTIME-001",
    fallback && fallback.stage ? fallback.stage : "runtime",
    fallback && fallback.message ? fallback.message + ": " + errorMessage(error) : errorMessage(error),
    fallback && fallback.fix ? fallback.fix : "Run the script in Scriptable, review the error details, then correct the named setting in Widget Studio and export again.",
    fallback && fallback.details ? fallback.details : {}
  )
}

function addRuntimeWarning(problem) {
  RUNTIME_WARNINGS.push(problem)
  console.warn(problem.code + " " + problem.message + (problem.fix ? " Fix: " + problem.fix : ""))
}

function diagnosticDetails(problem) {
  const lines = [problem.code + " · " + problem.stage, problem.message]
  if (problem.location) lines.push("Location: " + problem.location)
  if (problem.path) lines.push("Data field: " + problem.path)
  if (problem.expected || problem.received) lines.push("Expected: " + (problem.expected || "any") + " · Received: " + (problem.received || "unknown"))
  if (problem.source) lines.push("Source: " + problem.source)
  if (problem.fix) lines.push("Fix: " + problem.fix)
  return lines.join("\\n")
}

// STORAGE
const Storage = {
  manager: FileManager.local(),

  fileName() {
    const prefix = String(STORAGE_NAMESPACE || Script.name() || "widget")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "widget"
    return prefix + "-" + STORAGE_FILE_NAME
  },

  path() {
    return this.manager.joinPath(this.manager.documentsDirectory(), this.fileName())
  },

  readRecord() {
    const path = this.path()
    if (!this.manager.fileExists(path)) return null
    try {
      const stored = JSON.parse(this.manager.readString(path))
      if (stored && stored.format === "scriptable-widget-cache" && stored.version === 1) return stored
      return { format: "scriptable-widget-cache", version: 1, updatedAt: null, data: stored }
    } catch (error) {
      throw diagnosticError(createDiagnostic(
        "CACHE-002",
        "storage",
        "The cache file could not be read as JSON.",
        "Delete " + this.fileName() + " from Scriptable storage, then run the script or Shortcut again.",
        { source: this.fileName() }
      ))
    }
  },

  load() {
    const record = this.readRecord()
    return record ? record.data : null
  },

  save(value) {
    const record = {
      format: "scriptable-widget-cache",
      version: 1,
      updatedAt: new Date().toISOString(),
      data: value
    }
    try {
      this.manager.writeString(this.path(), JSON.stringify(record, null, 2))
    } catch (error) {
      throw diagnosticError(createDiagnostic(
        "CACHE-003",
        "storage",
        "Widget data could not be saved to " + this.fileName() + ".",
        "Check Scriptable storage access and available device space, then run the script again.",
        { source: this.fileName() }
      ))
    }
    return value
  },

  nextValue(value, updateMode, collectionKey) {
    if (updateMode === "overwrite") return value
    const current = this.load()
    const base = current && !Array.isArray(current) ? current : {}
    if (updateMode === "merge") {
      if (Array.isArray(value)) {
        throw diagnosticError(createDiagnostic(
          "SHORTCUT-004",
          "shortcut input",
          "Merge mode requires a Dictionary, but the Shortcut passed a List.",
          "Pass a Dictionary or change Data > Shortcuts update mode to Overwrite or Append, then export again.",
          { expected: "object", received: "array" }
        ))
      }
      return { ...base, ...value }
    }
    const items = collectionKey
      ? (Array.isArray(base[collectionKey]) ? [...base[collectionKey]] : [])
      : (Array.isArray(current) ? [...current] : [])
    const incoming = Array.isArray(value) ? value : [value]
    incoming.forEach((entry) => {
      const received = entry && typeof entry === "object" && !Array.isArray(entry)
        ? { ...entry, _receivedAt: new Date().toISOString() }
        : entry
      const signature = entry && entry.id !== undefined ? entry.id : JSON.stringify(entry)
      const duplicate = items.some((item) => {
        const itemSignature = item && item.id !== undefined ? item.id : JSON.stringify(withoutTimestamps(item))
        return itemSignature === signature
      })
      if (!duplicate) items.push(received)
    })
    return collectionKey ? { ...base, [collectionKey]: items } : items
  },

  remove() {
    const path = this.path()
    if (this.manager.fileExists(path)) this.manager.remove(path)
  }
}

// EXECUTION MODE
function executionMode() {
  if (config.runsInWidget) return "widget"
  if (DATA_SOURCE.kind === "shortcut" && config.runsWithSiri) return "shortcut"
  return "preview"
}

// DATA HELPERS
function parseShortcutInput(input) {
  if (input === null || input === undefined || input === "") {
    throw diagnosticError(createDiagnostic(
      "SHORTCUT-001",
      "shortcut input",
      "The Shortcut did not pass any widget data.",
      "In Shortcuts, connect a Dictionary, List, or JSON text value to Scriptable’s Run Script action.",
      { source: "args.shortcutParameter" }
    ))
  }
  let value = input
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch (error) {
      throw diagnosticError(createDiagnostic(
        "SHORTCUT-002",
        "shortcut input",
        "Shortcut text input is not valid JSON.",
        "Pass a Shortcuts Dictionary/List directly, or correct the JSON text before Run Script.",
        { source: "args.shortcutParameter" }
      ))
    }
  }
  if (!value || typeof value !== "object") {
    throw diagnosticError(createDiagnostic(
      "SHORTCUT-003",
      "shortcut input",
      "Shortcut input must be a Dictionary or List.",
      "Change the value connected to Run Script, then run the Shortcut again.",
      { received: valueType(value), source: "args.shortcutParameter" }
    ))
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

function requireSystemSymbol(name, location) {
  const symbol = SFSymbol.named(String(name || ""))
  if (symbol) return symbol
  throw diagnosticError(createDiagnostic(
    "SYMBOL-002",
    "render",
    "SF Symbol “" + String(name || "") + "” is unavailable on this device.",
    "Open " + location + " in Widget Studio, enter a valid SF Symbol name, and export again.",
    { location, source: String(name || "") }
  ))
}

async function loadRemoteImage(url, location) {
  if (!url) {
    addRuntimeWarning(createDiagnostic("IMAGE-004", "image", "No image URL was provided.", "Correct the image URL or bound image field in Widget Studio.", { location }))
    return null
  }
  try {
    const request = new Request(String(url))
    request.timeoutInterval = 12
    const image = await request.loadImage()
    const statusCode = request.response && request.response.statusCode
    if (statusCode && (statusCode < 200 || statusCode >= 300)) throw new Error("HTTP " + statusCode)
    return image
  } catch (error) {
    addRuntimeWarning(createDiagnostic(
      "IMAGE-005",
      "image",
      "Could not load the image: " + errorMessage(error),
      "Check the image URL or bound field at " + location + ".",
      { location, source: String(url) }
    ))
    return null
  }
}

async function imageWithOpacity(image, opacity, backgroundColor) {
  if (!image) return null
  const clampedOpacity = Math.max(0, Math.min(1, Number(opacity)))
  if (clampedOpacity >= 1) return image
  if (clampedOpacity <= 0) return null

  try {
    const sourceData = Data.fromPNG(image).toBase64String()
    const webView = new WebView()
    await webView.loadHTML('<img id="source" src="data:image/png;base64,' + sourceData + '">')
    const script = [
      'const image = document.getElementById("source");',
      'const render = () => {',
      '  const composite = document.createElement("canvas");',
      '  composite.width = image.naturalWidth;',
      '  composite.height = image.naturalHeight;',
      '  const compositeContext = composite.getContext("2d");',
      '  compositeContext.fillStyle = ' + JSON.stringify(String(backgroundColor || '#00000000')) + ';',
      '  compositeContext.fillRect(0, 0, composite.width, composite.height);',
      '  compositeContext.drawImage(image, 0, 0);',
      '  const canvas = document.createElement("canvas");',
      '  canvas.width = image.naturalWidth;',
      '  canvas.height = image.naturalHeight;',
      '  const context = canvas.getContext("2d");',
      '  context.clearRect(0, 0, canvas.width, canvas.height);',
      '  context.globalAlpha = ' + clampedOpacity + ';',
      '  context.drawImage(composite, 0, 0);',
      '  completion(canvas.toDataURL("image/png").split(",")[1]);',
      '};',
      'if (image.complete) render(); else image.onload = render;'
    ].join('\\n')
    const transparentData = await webView.evaluateJavaScript(script, true)
    return transparentData ? Image.fromData(Data.fromBase64String(transparentData)) : null
  } catch (error) {
    addRuntimeWarning(createDiagnostic(
      "IMAGE-006",
      "background image",
      "Could not apply background image opacity: " + errorMessage(error),
      "Use a smaller image, remove partial background opacity, or correct the image URL in Widget Studio.",
      {}
    ))
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
  for (const contract of EXPECTED_FIELDS) {
    const value = valueAtPath(data, contract.path)
    const receivedType = valueType(value)
    if (value === undefined) {
      issues.push(createDiagnostic(
        "DATA-004",
        "data contract",
        "Required field “" + contract.path + "” is missing.",
        "Correct the source or binding at " + contract.location + ", then run the script again.",
        { location: contract.location, path: contract.path, expected: contract.expectedType, received: "undefined" }
      ))
    } else if (contract.expectedType !== "null" && contract.expectedType !== "present value" && receivedType !== contract.expectedType) {
      issues.push(createDiagnostic(
        "DATA-005",
        "data contract",
        "Field “" + contract.path + "” changed type.",
        "Correct the API/Shortcut value or add the appropriate transform for " + contract.location + ".",
        { location: contract.location, path: contract.path, expected: contract.expectedType, received: receivedType }
      ))
    }
  }
  return issues
}

function prepareWidgetData(rawValue) {
  const data = applyTransforms(rawValue)
  const issues = inspectBindings(data)
  if (issues.length) throw diagnosticError(issues[0])
  return data
}

function readCacheCandidate(failures) {
  try {
    return Storage.readRecord()
  } catch (error) {
    failures.push(normalizeDiagnostic(error))
    return null
  }
}

function preparedFallback(rawValue, kind, failures, updatedAt) {
  try {
    const data = prepareWidgetData(rawValue)
    const problem = failures.length ? failures[0] : null
    if (problem) addRuntimeWarning(problem)
    return { data, status: { kind, updatedAt: updatedAt || null, problem } }
  } catch (error) {
    failures.push(normalizeDiagnostic(error))
    return null
  }
}

async function loadSourceData() {
  const failures = []

  try {
    const customData = await loadWidgetData()
    if (customData !== null && customData !== undefined) {
      return { data: prepareWidgetData(customData), status: { kind: "custom", updatedAt: null, problem: null } }
    }
  } catch (error) {
    failures.push(normalizeDiagnostic(error, {
      code: "CUSTOM-001",
      stage: "loadWidgetData",
      message: "Custom data loading failed",
      fix: "Correct loadWidgetData() near the top of this script, or return null to use the configured Widget Studio source."
    }))
  }

  if (DATA_SOURCE.kind === "snapshot") {
    const builtIn = preparedFallback(PREVIEW_DATA, "built-in", failures)
    if (builtIn) return builtIn
  }

  if (DATA_SOURCE.kind === "shortcut") {
    const cached = readCacheCandidate(failures)
    if (cached) {
      const stored = preparedFallback(cached.data, "stored", failures, cached.updatedAt)
      if (stored) return stored
    }
    const captured = preparedFallback(prepareCapturedData(PREVIEW_DATA), "sample", failures)
    if (captured) return captured
  }

  if (DATA_SOURCE.kind === "http-json") {
    if (!/^https?:\\/\\//i.test(DATA_SOURCE.url || "")) {
      failures.push(createDiagnostic(
        "HTTP-001",
        "web API",
        "The Web API URL is missing or incomplete.",
        "Open Widget Studio > Data > Web API, enter a complete HTTP or HTTPS URL, and export again.",
        { source: DATA_SOURCE.url || "not configured" }
      ))
    } else {
      try {
        const request = new Request(DATA_SOURCE.url)
        request.timeoutInterval = 15
        const response = await request.loadJSON()
        const statusCode = request.response && request.response.statusCode
        if (statusCode && (statusCode < 200 || statusCode >= 300)) {
          throw diagnosticError(createDiagnostic(
            "HTTP-002",
            "web API",
            "The Web API returned HTTP " + statusCode + ".",
            "Check the endpoint, permissions, and response in Widget Studio > Data, then export again.",
            { source: DATA_SOURCE.url, received: "HTTP " + statusCode }
          ))
        }
        const data = prepareWidgetData(response)
        try {
          Storage.save(response)
        } catch (error) {
          addRuntimeWarning(normalizeDiagnostic(error))
        }
        return { data, status: { kind: "live", updatedAt: new Date().toISOString(), problem: null } }
      } catch (error) {
        failures.push(normalizeDiagnostic(error, {
          code: "HTTP-003",
          stage: "web API",
          message: "The Web API request failed",
          fix: "Check the endpoint and internet connection, then run the script again.",
          details: { source: DATA_SOURCE.url }
        }))
      }
    }

    const cached = readCacheCandidate(failures)
    if (cached) {
      const cachedResult = preparedFallback(cached.data, "cache", failures, cached.updatedAt)
      if (cachedResult) return cachedResult
    }
    const sampleResult = preparedFallback(PREVIEW_DATA, "sample", failures)
    if (sampleResult) return sampleResult
  }

  const problem = failures[0] || createDiagnostic("DATA-006", "data source", "No valid widget data is available.", "Configure a valid source in Widget Studio and export again.", {})
  throw diagnosticError(problem)
}

function formatValue(value, options) {
  if (value === null || value === undefined || value === "") return options.fallback || "—"
  let output = value
  if (typeof output === "number") {
    if (options.percentage) output *= 100
    if (options.compact && Math.abs(output) >= 1000) {
      const absolute = Math.abs(output)
      const divisor = absolute >= 1000000000 ? 1000000000 : absolute >= 1000000 ? 1000000 : 1000
      const unit = divisor === 1000000000 ? "B" : divisor === 1000000 ? "M" : "K"
      output = (output / divisor).toFixed(1).replace(/\\.0$/, "") + unit
    } else {
      output = options.round ? Math.round(output) : output.toFixed(options.decimals)
    }
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
function ageLabel(value) {
  if (!value) return ""
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ""
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return minutes + "m ago"
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + "h ago"
  return Math.floor(hours / 24) + "d ago"
}

function appendRuntimeStatus(widget, status) {
  let label = ""
  if (status && status.kind === "cache") label = "Cached data" + (ageLabel(status.updatedAt) ? " · " + ageLabel(status.updatedAt) : "")
  else if (status && status.kind === "sample") label = "Sample data · run script to diagnose"
  else if (RUNTIME_WARNINGS.length) label = RUNTIME_WARNINGS[0].code + " · run script to diagnose"
  if (!label) return

  widget.addSpacer(4)
  const text = widget.addText(label)
  text.font = Font.mediumSystemFont(8)
  text.textColor = new Color("#fbbf24")
  text.textOpacity = 0.9
  text.lineLimit = 1
  text.minimumScaleFactor = 0.65
}

function renderErrorWidget(problem) {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#23171a")
  widget.setPadding(14, 14, 14, 14)
  widget.url = URLScheme.forOpeningScript()
  const code = widget.addText(problem.code + " · Widget needs attention")
  code.font = Font.semiboldSystemFont(11)
  code.textColor = new Color("#fca5a5")
  widget.addSpacer(7)
  const message = widget.addText(problem.message)
  message.font = Font.semiboldSystemFont(13)
  message.textColor = Color.white()
  message.lineLimit = 3
  message.minimumScaleFactor = 0.7
  if (problem.location || problem.path) {
    widget.addSpacer(5)
    const location = widget.addText(problem.location || problem.path)
    location.font = Font.mediumSystemFont(9)
    location.textColor = new Color("#fecaca")
    location.lineLimit = 2
  }
  widget.addSpacer()
  const fix = widget.addText("Tap to open the script. " + problem.fix)
  fix.font = Font.systemFont(9)
  fix.textColor = new Color("#d1d5db")
  fix.lineLimit = 3
  fix.minimumScaleFactor = 0.65
  return widget
}

async function showDiagnosticAlert(title, problem) {
  const alert = new Alert()
  alert.title = title
  alert.message = diagnosticDetails(problem)
  alert.addAction("Done")
  await alert.presentAlert()
}

function renderDisabledWidget(family) {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#172033")
  widget.setPadding(16, 16, 16, 16)
  const label = family ? family.charAt(0).toUpperCase() + family.slice(1) : "This"
  const title = widget.addText(label + " layout disabled")
  title.font = Font.semiboldSystemFont(14)
  title.textColor = Color.white()
  widget.addSpacer(6)
  const accessory = String(family || "").indexOf("accessory") === 0
  const detail = widget.addText(accessory
    ? "This export supports Small, Medium, and Large Home Screen widgets."
    : "Enable this size in Widget Studio and export the script again.")
  detail.font = Font.systemFont(10)
  detail.textColor = new Color("#cbd5e1")
  return widget
}

async function renderWidget(data, family, runtimeStatus) {
${layoutBlocks.join('\n\n')}

  return renderDisabledWidget(family)
}

// ENTRY POINT
async function main() {
  const mode = executionMode()

  if (mode === "shortcut") {
    const input = parseShortcutInput(args.shortcutParameter)
    const nextValue = Storage.nextValue(input, DATA_SOURCE.updateMode, DATA_SOURCE.appendKey)
    const data = prepareWidgetData(nextValue)
    Storage.save(nextValue)
    Script.setShortcutOutput({
      ok: true,
      updatedAt: new Date().toISOString(),
      cacheFile: Storage.fileName(),
      fields: Object.keys(data)
    })
    return
  }

  const result = await loadSourceData()
  const requestedFamily = mode === "widget" ? config.widgetFamily : PREVIEW_FAMILY
  const family = requestedFamily === "extraLarge" ? "large" : requestedFamily
  const widget = await renderWidget(result.data || {}, family, result.status)

  if (mode === "widget") Script.setWidget(widget)
  else {
    const problem = result.status && result.status.problem ? result.status.problem : RUNTIME_WARNINGS[0]
    if (problem) await showDiagnosticAlert(result.status && result.status.kind === "cache" ? "Using cached widget data" : "Widget needs attention", problem)
    if (family === "small") await widget.presentSmall()
    else if (family === "large") await widget.presentLarge()
    else await widget.presentMedium()
  }
}

async function run() {
  try {
    await main()
  } catch (error) {
    const problem = normalizeDiagnostic(error)
    console.error(diagnosticDetails(problem))
    if (config.runsInWidget) Script.setWidget(renderErrorWidget(problem))
    else if (DATA_SOURCE.kind === "shortcut" && config.runsWithSiri) Script.setShortcutOutput({ ok: false, error: problem })
    else await showDiagnosticAlert("Widget could not run", problem)
  } finally {
    Script.complete()
  }
}

await run()
`
}

function valueType(value: unknown) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
