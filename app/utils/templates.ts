import type {
  DateProperties,
  EditorDocument,
  ImageProperties,
  PreviewSize,
  SpacerProperties,
  StackProperties,
  TextProperties,
  WidgetElement,
  WidgetProperties
} from '~/types/editor'
import { applyDataTransforms } from '~/utils/data'
import { createElement, DEFAULT_FORMAT, flattenJson, getValueAtPath } from '~/utils/editor'

export interface TemplateVariable {
  path: string
  label: string
  value: unknown
  kind: 'number' | 'text' | 'date' | 'boolean' | 'image'
}

export interface TemplateContentOptions {
  showLabel?: boolean
  imageUrl?: string
}

export type TemplateDomain = 'weather' | 'expense' | 'market' | 'schedule' | 'status' | 'general'
export type TemplateRecipe =
  | 'focus'
  | 'symbol'
  | 'split'
  | 'strip'
  | 'ledger'
  | 'ticker'
  | 'editorial'
  | 'band'
  | 'horizontal'
  | 'center'
  | 'matrix'
  | 'rail'
  | 'stacked'
  | 'corner'
  | 'triptych'
  | 'minimal'

interface TemplatePalette {
  id: string
  background: string
  foreground: string
  muted: string
  accent: string
  accentForeground: string
}

export interface WidgetTemplate {
  id: string
  recipe: TemplateRecipe
  name: string
  description: string
  icon: string
  accent: string
  layout: string
  size: PreviewSize
  domain: TemplateDomain
  palette: TemplatePalette
}

export interface BuiltWidgetTemplate {
  root: WidgetElement
  usedPaths: string[]
}

interface TemplateContext {
  domain: TemplateDomain
  variables: TemplateVariable[]
  primary: TemplateVariable
  supporting: TemplateVariable[]
  date?: TemplateVariable
  label?: TemplateVariable
  image?: TemplateVariable
}

export const TEMPLATE_DOMAIN_LABELS: Record<TemplateDomain, string> = {
  weather: 'Weather data',
  expense: 'Expense data',
  market: 'Market data',
  schedule: 'Schedule data',
  status: 'Status data',
  general: 'General data'
}

const RECIPE_ORDER: Record<PreviewSize, TemplateRecipe[]> = {
  small: [
    'focus', 'horizontal', 'stacked', 'center',
    'corner', 'split', 'ticker', 'rail',
    'matrix', 'band', 'symbol', 'triptych',
    'minimal', 'ledger', 'editorial', 'strip'
  ],
  medium: [
    'horizontal', 'stacked', 'matrix', 'center',
    'triptych', 'rail', 'corner', 'minimal',
    'strip', 'split', 'focus', 'ticker',
    'symbol', 'band', 'ledger', 'editorial'
  ],
  large: [
    'matrix', 'stacked', 'horizontal', 'rail',
    'ledger', 'editorial', 'triptych', 'center',
    'strip', 'split', 'focus', 'corner',
    'minimal', 'band', 'symbol', 'ticker'
  ]
}

const CONTENT_BUDGET: Record<PreviewSize, number> = {
  small: 0,
  medium: 1,
  large: 2
}

const RECIPE_ICONS: Record<TemplateRecipe, string> = {
  focus: 'i-lucide-focus',
  symbol: 'i-lucide-shapes',
  split: 'i-lucide-columns-2',
  strip: 'i-lucide-gallery-horizontal-end',
  ledger: 'i-lucide-list-tree',
  ticker: 'i-lucide-chart-no-axes-combined',
  editorial: 'i-lucide-text-quote',
  band: 'i-lucide-panel-bottom',
  horizontal: 'i-lucide-panels-left-right',
  center: 'i-lucide-align-center',
  matrix: 'i-lucide-grid-2x2',
  rail: 'i-lucide-panel-left',
  stacked: 'i-lucide-rows-3',
  corner: 'i-lucide-panel-top-open',
  triptych: 'i-lucide-columns-3',
  minimal: 'i-lucide-scan'
}

const RECIPE_LAYOUT_LABELS: Record<TemplateRecipe, string> = {
  focus: 'Hero',
  symbol: 'Symbol-led',
  split: 'Columns',
  strip: 'Horizontal',
  ledger: 'Rows',
  ticker: 'Ticker',
  editorial: 'Editorial',
  band: 'Band',
  horizontal: 'Left / right',
  center: 'Centered',
  matrix: 'Grid',
  rail: 'Edge rail',
  stacked: 'Vertical',
  corner: 'Corner',
  triptych: '3 columns',
  minimal: 'Sparse'
}

const RECIPE_NAMES: Record<TemplateRecipe, Record<TemplateDomain, string>> = {
  focus: {
    weather: 'Current conditions',
    expense: 'Daily total',
    market: 'Price focus',
    schedule: 'Next up',
    status: 'Status focus',
    general: 'Value focus'
  },
  symbol: {
    weather: 'Condition mark',
    expense: 'Wallet glance',
    market: 'Market mark',
    schedule: 'Event mark',
    status: 'Signal',
    general: 'Symbol glance'
  },
  split: {
    weather: 'Weather pair',
    expense: 'Spend pair',
    market: 'Price pair',
    schedule: 'Schedule pair',
    status: 'Status pair',
    general: 'Metric pair'
  },
  strip: {
    weather: 'Forecast line',
    expense: 'Activity line',
    market: 'Market line',
    schedule: 'Agenda line',
    status: 'Reading line',
    general: 'Data line'
  },
  ledger: {
    weather: 'Weather station',
    expense: 'Expense ledger',
    market: 'Market board',
    schedule: 'Agenda',
    status: 'System report',
    general: 'Field report'
  },
  ticker: {
    weather: 'Conditions ticker',
    expense: 'Spending ticker',
    market: 'Price ticker',
    schedule: 'Time ticker',
    status: 'Status ticker',
    general: 'Data ticker'
  },
  editorial: {
    weather: 'Weather note',
    expense: 'Spending note',
    market: 'Position note',
    schedule: 'Calendar note',
    status: 'Status note',
    general: 'Editorial'
  },
  band: {
    weather: 'Weather band',
    expense: 'Summary band',
    market: 'Market band',
    schedule: 'Schedule band',
    status: 'Signal band',
    general: 'Highlight band'
  },
  horizontal: {
    weather: 'Weather overview',
    expense: 'Spend overview',
    market: 'Market overview',
    schedule: 'Schedule overview',
    status: 'System overview',
    general: 'Horizontal overview'
  },
  center: {
    weather: 'Centered conditions',
    expense: 'Centered total',
    market: 'Centered price',
    schedule: 'Centered event',
    status: 'Centered status',
    general: 'Centered value'
  },
  matrix: {
    weather: 'Weather matrix',
    expense: 'Expense matrix',
    market: 'Market matrix',
    schedule: 'Schedule matrix',
    status: 'Status matrix',
    general: 'Data matrix'
  },
  rail: {
    weather: 'Weather rail',
    expense: 'Expense rail',
    market: 'Market rail',
    schedule: 'Schedule rail',
    status: 'Status rail',
    general: 'Data rail'
  },
  stacked: {
    weather: 'Conditions stack',
    expense: 'Spending stack',
    market: 'Market stack',
    schedule: 'Agenda stack',
    status: 'Status stack',
    general: 'Vertical stack'
  },
  corner: {
    weather: 'Corner conditions',
    expense: 'Corner total',
    market: 'Corner price',
    schedule: 'Corner event',
    status: 'Corner status',
    general: 'Corner value'
  },
  triptych: {
    weather: 'Three-part forecast',
    expense: 'Three-part summary',
    market: 'Three-part market',
    schedule: 'Three-part agenda',
    status: 'Three-part status',
    general: 'Three-part view'
  },
  minimal: {
    weather: 'Essential conditions',
    expense: 'Essential total',
    market: 'Essential price',
    schedule: 'Essential event',
    status: 'Essential status',
    general: 'Essential value'
  }
}

const COUNTDOWN_RECIPE_NAMES: Record<TemplateRecipe, string> = {
  focus: 'Countdown focus',
  symbol: 'Countdown mark',
  split: 'Split countdown',
  strip: 'Countdown strip',
  ledger: 'Type-led countdown',
  ticker: 'Digital countdown',
  editorial: 'Editorial countdown',
  band: 'Banded countdown',
  horizontal: 'Wide countdown',
  center: 'Centered countdown',
  matrix: 'Framed countdown',
  rail: 'Countdown rail',
  stacked: 'Tall countdown',
  corner: 'Corner countdown',
  triptych: 'Poster countdown',
  minimal: 'Essential countdown'
}

const PALETTES: Record<TemplateDomain, TemplatePalette[]> = {
  weather: [
    { id: 'daybreak', background: '#dceeff', foreground: '#17364d', muted: '#58788e', accent: '#e49532', accentForeground: '#172534' },
    { id: 'storm', background: '#193442', foreground: '#f5fbff', muted: '#a9c7d2', accent: '#7ed4ee', accentForeground: '#102b38' },
    { id: 'sunset', background: '#513e63', foreground: '#fff8f1', muted: '#d8c8df', accent: '#ffbd79', accentForeground: '#3a2948' },
    { id: 'mist', background: '#edf2ef', foreground: '#29463f', muted: '#668078', accent: '#4b8b7c', accentForeground: '#ffffff' }
  ],
  expense: [
    { id: 'ledger', background: '#17313a', foreground: '#f5fbf8', muted: '#9fc0b7', accent: '#f2b56b', accentForeground: '#30271c' },
    { id: 'mint', background: '#e6f1e8', foreground: '#183b32', muted: '#5e786f', accent: '#2d7965', accentForeground: '#ffffff' },
    { id: 'receipt', background: '#f4efe5', foreground: '#342d26', muted: '#776c61', accent: '#d6654d', accentForeground: '#ffffff' },
    { id: 'plum', background: '#3e2b46', foreground: '#fff8ff', muted: '#d3bfd9', accent: '#f0a6b8', accentForeground: '#352039' }
  ],
  market: [
    { id: 'bitcoin', background: '#141414', foreground: '#fff9ef', muted: '#aaa39a', accent: '#f7931a', accentForeground: '#21170b' },
    { id: 'terminal', background: '#10231e', foreground: '#effff8', muted: '#95b9aa', accent: '#63d5a5', accentForeground: '#10231e' },
    { id: 'exchange', background: '#e8edf7', foreground: '#172446', muted: '#66718c', accent: '#3859c7', accentForeground: '#ffffff' },
    { id: 'signal', background: '#332c4d', foreground: '#fbf8ff', muted: '#c7c0db', accent: '#ffc768', accentForeground: '#352c3f' }
  ],
  schedule: [
    { id: 'calendar', background: '#e8edf8', foreground: '#1d2d50', muted: '#69748b', accent: '#3f67d7', accentForeground: '#ffffff' },
    { id: 'night', background: '#252c3a', foreground: '#f8faff', muted: '#aeb7c9', accent: '#9ab8ff', accentForeground: '#1c263b' },
    { id: 'coral', background: '#fff0ea', foreground: '#4b302b', muted: '#8c6c66', accent: '#d9604b', accentForeground: '#ffffff' },
    { id: 'sage', background: '#e9efe9', foreground: '#294238', muted: '#6b7e75', accent: '#4e846e', accentForeground: '#ffffff' }
  ],
  status: [
    { id: 'console', background: '#172033', foreground: '#f7f9ff', muted: '#a9b3c8', accent: '#6fd2c2', accentForeground: '#132d2a' },
    { id: 'utility', background: '#eef1f5', foreground: '#243044', muted: '#6b7585', accent: '#4268c7', accentForeground: '#ffffff' },
    { id: 'amber', background: '#3e3525', foreground: '#fffaf0', muted: '#d1c3a7', accent: '#f2bd57', accentForeground: '#37280d' },
    { id: 'aqua', background: '#dff3f1', foreground: '#18413d', muted: '#5b7d78', accent: '#2a8277', accentForeground: '#ffffff' }
  ],
  general: [
    { id: 'ink', background: '#172033', foreground: '#f8fafc', muted: '#a9b5c8', accent: '#8de1d1', accentForeground: '#173631' },
    { id: 'paper', background: '#f0eee8', foreground: '#302e2a', muted: '#74706a', accent: '#b85f4b', accentForeground: '#ffffff' },
    { id: 'blueprint', background: '#e8eeff', foreground: '#172458', muted: '#65719b', accent: '#3154c8', accentForeground: '#ffffff' },
    { id: 'forest', background: '#eaf0ea', foreground: '#173d36', muted: '#64837b', accent: '#2d6257', accentForeground: '#ffffff' }
  ]
}

const DOMAIN_PATTERNS: Record<Exclude<TemplateDomain, 'general'>, RegExp[]> = {
  weather: [/weather/, /forecast/, /temperature/, /\btemp\b/, /condition/, /humidity/, /precip/, /rain/, /wind/, /sunrise/, /sunset/, /feels.?like/],
  expense: [/expense/, /spend/, /spent/, /budget/, /merchant/, /transaction/, /income/, /cost/, /balance/, /category/],
  market: [/bitcoin/, /\bbtc\b/, /crypto/, /market/, /ticker/, /price/, /portfolio/, /holding/, /profit/, /\bpnl\b/, /fear.?greed/, /change/],
  schedule: [/countdown/, /days?.?(to.?go|until)/, /target.?date/, /calendar/, /event/, /agenda/, /meeting/, /appointment/, /deadline/, /schedule/, /start.?time/, /end.?time/],
  status: [/battery/, /charge/, /uptime/, /latency/, /health/, /status/, /progress/, /completion/, /storage/, /memory/]
}

const PRIMARY_PATTERNS: Record<TemplateDomain, RegExp[]> = {
  weather: [/temperature/, /\btemp\b/, /current/, /feels.?like/, /condition/, /weather/],
  expense: [/today.?spend/, /spent.?today/, /remaining/, /budget/, /total/, /spend/, /expense/, /balance/, /income/, /amount/],
  market: [/current.?price/, /price/, /portfolio.?value/, /value/, /profit/, /\bpnl\b/, /change/, /holding/],
  schedule: [/days?.?(to.?go|until)/, /title/, /event/, /countdown/, /remaining/, /next/, /start/, /time/, /count/],
  status: [/status/, /progress/, /battery/, /charge/, /health/, /uptime/, /latency/],
  general: [/total/, /value/, /current/, /count/, /score/, /amount/]
}

const KNOWN_ACRONYMS = new Map([
  ['aqi', 'AQI'],
  ['btc', 'BTC'],
  ['eth', 'ETH'],
  ['eur', 'EUR'],
  ['gbp', 'GBP'],
  ['inr', 'INR'],
  ['jpy', 'JPY'],
  ['pnl', 'P&L'],
  ['usd', 'USD']
])

function normalizedPath(path: string) {
  return path
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\./g, ' ')
    .toLowerCase()
}

function humanizePath(path: string) {
  const parts = path.split('.').filter(Boolean)
  const leaf = parts.at(-1) || path
  const source = /^\d+$/.test(leaf) ? (parts.at(-2) || leaf) : leaf
  const words = normalizedPath(source).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return path
  return words.map((word, index) => {
    const known = KNOWN_ACRONYMS.get(word)
    if (known) return known
    return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word
  }).join(' ')
}

function hasDateHint(path: string) {
  const hints = new Set(['date', 'time', 'updated', 'created', 'timestamp', 'start', 'end', 'deadline'])
  return normalizedPath(path).split(/[^a-z0-9]+/).some(token => hints.has(token))
}

function hasImageHint(path: string, value: unknown) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false
  return /(image|photo|poster|artwork|thumbnail|cover|logo|backdrop|picture)/.test(normalizedPath(path))
    || /\.(avif|gif|jpe?g|png|webp)(?:\?.*)?$/i.test(value)
}

export function getTemplateVariables(document: EditorDocument): TemplateVariable[] {
  const exposedOrder = new Map(document.data.selectedPaths.map((path, index) => [path, index]))
  const previewData = applyDataTransforms(document.data.sampleData, document.data.transforms, document.data.source)
  return flattenJson(previewData)
    .map((leaf) => {
      const value = getValueAtPath(previewData, leaf.path)
      const kind = hasImageHint(leaf.path, value)
        ? 'image'
        : hasDateHint(leaf.path) && (typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())))
          ? 'date'
          : typeof value === 'number'
            ? 'number'
            : typeof value === 'boolean'
              ? 'boolean'
              : 'text'
      return { path: leaf.path, label: humanizePath(leaf.path), value, kind } as TemplateVariable
    })
    .sort((a, b) => {
      const aOrder = exposedOrder.get(a.path)
      const bOrder = exposedOrder.get(b.path)
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
      if (aOrder !== undefined) return -1
      if (bOrder !== undefined) return 1
      return 0
    })
}

export function detectTemplateDomain(document: EditorDocument): TemplateDomain {
  const variables = getTemplateVariables(document)
  const scores = Object.fromEntries(Object.keys(DOMAIN_PATTERNS).map(domain => [domain, 0])) as Record<Exclude<TemplateDomain, 'general'>, number>

  variables.forEach((variable) => {
    const haystack = `${normalizedPath(variable.path)} ${typeof variable.value === 'string' ? variable.value.toLowerCase() : ''}`
    ;(Object.keys(DOMAIN_PATTERNS) as Exclude<TemplateDomain, 'general'>[]).forEach((domain) => {
      DOMAIN_PATTERNS[domain].forEach((pattern, index) => {
        if (pattern.test(haystack)) scores[domain] += index < 3 ? 3 : 1
      })
    })
  })

  const [domain, score] = (Object.entries(scores) as [Exclude<TemplateDomain, 'general'>, number][])
    .sort((a, b) => b[1] - a[1])[0] || ['general', 0]
  return score >= 2 ? domain : 'general'
}

function rankForDomain(variable: TemplateVariable, domain: TemplateDomain, index: number) {
  const path = normalizedPath(variable.path)
  let score = variable.kind === 'number' ? 12 : variable.kind === 'boolean' ? 3 : 6
  if (variable.kind === 'date') score = -10
  const roleScore = PRIMARY_PATTERNS[domain].reduce((highest, pattern, patternIndex) => (
    pattern.test(path) ? Math.max(highest, Math.max(3, 18 - patternIndex * 2)) : highest
  ), 0)
  score += roleScore
  return score - index * 0.01
}

function getTemplateContext(document: EditorDocument): TemplateContext {
  const variables = getTemplateVariables(document)
  if (!variables.length) throw new Error('Load JSON with at least one value before generating layouts.')
  const domain = detectTemplateDomain(document)
  const date = variables.find(variable => variable.kind === 'date')
  const image = variables.find(variable => variable.kind === 'image')
  const displayable = variables.filter(variable => variable.kind !== 'date' && variable.kind !== 'image')
  const ranked = displayable
    .map((variable, index) => ({ variable, score: rankForDomain(variable, domain, index) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.variable)
  const primary = ranked[0] || variables[0]!
  const supporting = ranked.filter(variable => variable.path !== primary.path)
  const label = ranked.find((variable) => {
    if (variable.kind !== 'text' || variable.path === primary.path) return false
    const path = normalizedPath(variable.path)
    return /(event title|countdown label|title|event name|label|name)/.test(path) && !/(date|time)/.test(path)
  })
  return { domain, variables, primary, supporting, date, label, image }
}

function isCountdownContext(context: TemplateContext) {
  return context.domain === 'schedule'
    && context.variables.some(variable => /(countdown|days.?to.?go|days.?until|target.?date)/.test(normalizedPath(variable.path)))
}

export function isCountdownDocument(document: EditorDocument) {
  return isCountdownContext(getTemplateContext(document))
}

function limitTemplateContext(context: TemplateContext, size: PreviewSize) {
  return {
    ...context,
    supporting: isCountdownContext(context) ? [] : context.supporting.slice(0, CONTENT_BUDGET[size])
  }
}

function recipeName(context: TemplateContext, recipe: TemplateRecipe) {
  return isCountdownContext(context) ? COUNTDOWN_RECIPE_NAMES[recipe] : RECIPE_NAMES[recipe][context.domain]
}

function templateDescription(context: TemplateContext, recipe: TemplateRecipe) {
  if (isCountdownContext(context)) {
    return recipe === 'minimal'
      ? `Shows only ${context.primary.label}, with the event label optional.`
      : `Keeps ${context.primary.label} dominant, with one optional label or image.`
  }
  const supporting = context.supporting.slice(0, ['ledger', 'matrix', 'stacked', 'triptych'].includes(recipe) ? 3 : 2).map(variable => variable.label)
  if (recipe === 'minimal') return `Keeps only ${context.primary.label} at maximum scale.`
  if (recipe === 'center') return `Centers ${context.primary.label} and reduces the supporting hierarchy.`
  if (recipe === 'corner') return `Pairs an oversized ${context.primary.label} with a corner symbol.`
  if (!supporting.length) return `A ${recipeName(context, recipe).toLowerCase()} treatment for ${context.primary.label}.`
  const tail = supporting.length === 1 ? supporting[0] : `${supporting.slice(0, -1).join(', ')} and ${supporting.at(-1)}`
  if (recipe === 'horizontal') return `Places ${context.primary.label} beside a vertical ${tail} stack.`
  if (recipe === 'matrix') return `Balances ${context.primary.label}, ${tail} in an equal grid.`
  if (recipe === 'rail') return `Uses a strong edge rail beside ${context.primary.label} and ${tail}.`
  if (recipe === 'stacked') return `Stacks ${context.primary.label}, ${tail} vertically with descending scale.`
  if (recipe === 'triptych') return `Gives ${context.primary.label}, ${tail} equal column weight.`
  return `${context.primary.label} leads, with ${tail} kept secondary.`
}

export function generateWidgetTemplateOptions(document: EditorDocument, size: PreviewSize, generation = 0, count = 4): WidgetTemplate[] {
  const context = limitTemplateContext(getTemplateContext(document), size)
  const recipes = RECIPE_ORDER[size]
  const palettes = PALETTES[context.domain]
  const start = (Math.max(0, generation) * count) % recipes.length

  return Array.from({ length: Math.min(count, recipes.length) }, (_, index) => {
    const recipe = recipes[(start + index) % recipes.length]!
    const palette = palettes[(generation * 2 + index) % palettes.length]!
    return {
      id: `${size}-${recipe}-${palette.id}-${generation}`,
      recipe,
      name: recipeName(context, recipe),
      description: templateDescription(context, recipe),
      icon: RECIPE_ICONS[recipe],
      accent: palette.accent,
      layout: RECIPE_LAYOUT_LABELS[recipe],
      size,
      domain: context.domain,
      palette
    }
  })
}

function stack(type: 'verticalStack' | 'horizontalStack', name: string, children: WidgetElement[], overrides: Partial<StackProperties> = {}) {
  const element = createElement(type)
  element.name = name
  element.children = children
  Object.assign(element.properties, { spacing: 0, ...overrides })
  return element
}

function gap(size: number) {
  const element = createElement('spacer')
  element.name = `${size} pt gap`
  Object.assign(element.properties as SpacerProperties, { mode: 'fixed', size })
  return element
}

function flexibleSpace() {
  const element = createElement('spacer')
  element.name = 'Flexible space'
  Object.assign(element.properties as SpacerProperties, { mode: 'flexible', size: 0 })
  return element
}

function staticText(content: string, overrides: Partial<TextProperties> = {}) {
  const element = createElement('text')
  element.name = content
  Object.assign(element.properties as TextProperties, {
    contentMode: 'static',
    content,
    fontSize: 11,
    weight: 'semibold',
    color: '#ffffff',
    ...overrides
  })
  return element
}

function inferredFormat(variable: TemplateVariable) {
  const path = normalizedPath(variable.path)
  const numeric = typeof variable.value === 'number'
  const percentage = numeric && /(percent|percentage|ratio|rate)/.test(path) && Math.abs(variable.value as number) <= 1
  const currency = /\busd\b/.test(path)
    ? '$'
    : /\binr\b/.test(path)
      ? '₹'
      : /\beur\b/.test(path)
        ? '€'
        : /\bgbp\b/.test(path)
          ? '£'
          : /\bjpy\b/.test(path)
            ? '¥'
            : ''
  const suffix = numeric && !percentage && /(temperature|\btemp\b|feels.?like)/.test(path)
    ? '°'
    : numeric && !percentage && /(percent|percentage)/.test(path)
      ? '%'
      : numeric && !currency && /\bbtc\b/.test(path) && !/price/.test(path)
        ? ' BTC'
        : ''
  return {
    ...DEFAULT_FORMAT,
    currency,
    suffix,
    decimals: numeric && !Number.isInteger(variable.value) ? (currency ? 2 : 1) : 0,
    percentage
  }
}

function variableText(variable: TemplateVariable, overrides: Partial<TextProperties> = {}) {
  const element = createElement('text')
  element.name = variable.label
  const { format, ...rest } = overrides
  Object.assign(element.properties as TextProperties, {
    contentMode: 'variable',
    content: '',
    variable: variable.path,
    font: 'rounded',
    fontSize: 24,
    weight: 'bold',
    color: '#ffffff',
    lineLimit: 1,
    minimumScaleFactor: 0.55,
    format: { ...inferredFormat(variable), ...(format || {}) },
    ...rest
  })
  return element
}

function dateNode(variable: TemplateVariable | undefined, color: string, fontSize = 11) {
  const element = createElement('date')
  element.name = variable?.label || 'Current date'
  Object.assign(element.properties as DateProperties, {
    sourceType: variable ? 'variable' : 'now',
    variable: variable?.path || '',
    dateFormat: 'EEE, MMM d',
    relativeDate: false,
    color,
    fontSize,
    weight: 'medium'
  })
  return element
}

function weatherSymbol(context: TemplateContext) {
  const sample = context.variables.map(variable => `${variable.path} ${String(variable.value)}`).join(' ').toLowerCase()
  if (/(rain|drizzle|storm)/.test(sample)) return 'cloud.rain.fill'
  if (/snow/.test(sample)) return 'snowflake'
  if (/(night|moon)/.test(sample)) return 'moon.stars.fill'
  if (/cloud/.test(sample)) return 'cloud.sun.fill'
  return 'sun.max.fill'
}

function symbolName(context: TemplateContext) {
  if (context.domain === 'weather') return weatherSymbol(context)
  if (context.domain === 'expense') return 'wallet.pass.fill'
  if (context.domain === 'market') {
    const sample = context.variables.map(variable => `${variable.path} ${String(variable.value)}`).join(' ').toLowerCase()
    return /(bitcoin|\bbtc\b)/.test(sample) ? 'bitcoinsign.circle.fill' : 'chart.line.uptrend.xyaxis'
  }
  if (context.domain === 'schedule') return isCountdownContext(context) ? 'timer' : 'calendar'
  if (context.domain === 'status') return 'gauge.with.dots.needle.67percent'
  return 'chart.bar.fill'
}

function symbolNode(context: TemplateContext, color: string, size = 18) {
  const element = createElement('image')
  element.name = `${TEMPLATE_DOMAIN_LABELS[context.domain]} symbol`
  Object.assign(element.properties as ImageProperties, {
    systemSymbol: symbolName(context),
    width: size,
    height: size,
    tintColor: color,
    cornerRadius: 0
  })
  return element
}

function countdownImageNode(
  context: TemplateContext,
  imageUrl: string,
  width: number,
  height: number,
  cornerRadius: number
) {
  const source = imageUrl.trim()
  if (!source && !context.image) return
  const element = createElement('image')
  element.name = 'Countdown image'
  Object.assign(element.properties as ImageProperties, {
    sourceType: 'remote',
    remoteMode: source ? 'static' : 'variable',
    remoteUrl: source,
    variable: source ? '' : context.image?.path || '',
    fallbackUrl: '',
    width,
    height,
    tintColor: '#ffffff',
    cornerRadius,
    opacity: 1,
    contentMode: 'fill'
  })
  return element
}

function countdownTextBlock(
  context: TemplateContext,
  template: WidgetTemplate,
  showLabel: boolean,
  alignment: StackProperties['alignment']
) {
  const { size, palette, recipe } = template
  const label = showLabel ? context.label : undefined
  const valueSize = size === 'large' ? 72 : size === 'medium' ? 54 : 44
  const font = recipe === 'ticker' ? 'monospaced' : recipe === 'editorial' ? 'serif' : 'rounded'
  const children: WidgetElement[] = []

  if (label) {
    children.push(variableText(label, {
      color: palette.muted,
      font: recipe === 'editorial' ? 'serif' : 'system',
      fontSize: size === 'large' ? 15 : 11,
      weight: 'semibold',
      alignment,
      lineLimit: 2,
      minimumScaleFactor: 0.75
    }))
    children.push(gap(size === 'large' ? 18 : 10))
  }

  children.push(variableText(context.primary, {
    color: recipe === 'band' ? palette.accent : palette.foreground,
    font,
    fontSize: valueSize,
    weight: 'bold',
    alignment,
    minimumScaleFactor: 0.45
  }))
  children.push(gap(size === 'large' ? 8 : 5))
  children.push(staticText(context.primary.label, {
    color: palette.muted,
    font: recipe === 'ticker' ? 'monospaced' : 'system',
    fontSize: size === 'large' ? 13 : 10,
    weight: 'semibold',
    alignment,
    opacity: 0.9
  }))

  return stack('verticalStack', 'Countdown', children, { alignment })
}

function buildCountdown(
  template: WidgetTemplate,
  context: TemplateContext,
  options: TemplateContentOptions = {}
): BuiltWidgetTemplate {
  const { size, palette, recipe } = template
  const showLabel = options.showLabel !== false
  const alignment: StackProperties['alignment'] = ['center', 'minimal', 'matrix', 'triptych'].includes(recipe)
    ? 'center'
    : ['corner', 'rail'].includes(recipe)
      ? 'trailing'
      : 'leading'
  const text = countdownTextBlock(context, template, showLabel, alignment)
  const verticalImage = size === 'large' && ['editorial', 'stacked', 'matrix', 'triptych', 'minimal'].includes(recipe)
  const image = countdownImageNode(
    context,
    options.imageUrl || '',
    verticalImage ? 290 : size === 'large' ? 128 : size === 'medium' ? 108 : 44,
    verticalImage ? 164 : size === 'large' ? 280 : size === 'medium' ? 124 : 44,
    size === 'small' ? 12 : 18
  )

  let content: WidgetElement
  let padding = size === 'large' ? 24 : 17

  if (image && verticalImage) {
    content = stack('verticalStack', template.name, [
      image,
      gap(size === 'large' ? 24 : 14),
      text
    ], { alignment })
    padding = 24
  } else if (image) {
    content = stack('horizontalStack', template.name, alignment === 'trailing'
      ? [image, flexibleSpace(), text]
      : [text, flexibleSpace(), image])
  } else if (recipe === 'band') {
    const band = stack('horizontalStack', 'Countdown band', [
      staticText(context.primary.label, {
        color: palette.accentForeground,
        fontSize: size === 'large' ? 13 : 10,
        weight: 'bold'
      })
    ], { padding: size === 'large' ? 18 : 13, backgroundColor: palette.accent })
    const mainChildren = text.children.slice(0, -2)
    content = stack('verticalStack', template.name, [
      stack('verticalStack', 'Countdown value', mainChildren, {
        alignment,
        padding: size === 'large' ? 24 : 17
      }),
      flexibleSpace(),
      band
    ], { alignment })
    padding = 0
  } else if (recipe === 'rail') {
    content = stack('horizontalStack', template.name, [
      stack('verticalStack', 'Accent rail', [flexibleSpace()], {
        padding: size === 'large' ? 5 : 4,
        backgroundColor: palette.accent
      }),
      flexibleSpace(),
      stack('verticalStack', 'Rail content', [text], {
        alignment: 'trailing',
        padding: size === 'large' ? 24 : 17
      })
    ])
    padding = 0
  } else {
    const children: WidgetElement[] = []
    if (alignment === 'center') children.push(flexibleSpace())
    children.push(text)
    if (alignment === 'center' || size === 'large') children.push(flexibleSpace())
    content = stack('verticalStack', template.name, children, { alignment })
  }

  const used = [
    context.primary,
    showLabel ? context.label : undefined,
    !options.imageUrl?.trim() ? context.image : undefined
  ]
  return {
    root: widget(size, palette.background, padding, content),
    usedPaths: uniquePaths(used)
  }
}

function widget(size: PreviewSize, backgroundColor: string, padding: number, child: WidgetElement) {
  const root = createElement('widget')
  Object.assign(root.properties as WidgetProperties, { previewSize: size, backgroundColor, padding })
  root.children = [child]
  return root
}

function uniquePaths(variables: Array<TemplateVariable | undefined>) {
  return [...new Set(variables.filter(Boolean).map(variable => variable!.path))]
}

function metricColumn(variable: TemplateVariable, palette: TemplatePalette, valueSize = 16, align: StackProperties['alignment'] = 'leading') {
  return stack('verticalStack', variable.label, [
    staticText(variable.label, { color: palette.muted, fontSize: 10, weight: 'medium', alignment: align }),
    gap(4),
    variableText(variable, { color: palette.foreground, fontSize: valueSize, weight: 'semibold', alignment: align })
  ], { alignment: align })
}

function metricRow(variable: TemplateVariable, palette: TemplatePalette, prominent = false) {
  return stack('horizontalStack', `${variable.label} row`, [
    staticText(variable.label, { color: prominent ? palette.foreground : palette.muted, fontSize: prominent ? 11 : 10, weight: 'medium' }),
    flexibleSpace(),
    variableText(variable, {
      color: prominent ? palette.accent : palette.foreground,
      font: prominent ? 'rounded' : 'system',
      fontSize: prominent ? 21 : 15,
      weight: prominent ? 'bold' : 'semibold',
      alignment: 'trailing'
    })
  ])
}

function buildFocus(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 3 : size === 'medium' ? 2 : 1)
  const valueSize = size === 'large' ? 48 : size === 'medium' ? 38 : 30
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [
      symbolNode(context, palette.accent, size === 'large' ? 21 : 17), gap(7),
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' }),
      flexibleSpace(), dateNode(context.date, palette.muted, 10)
    ]),
    flexibleSpace(),
    variableText(context.primary, { color: palette.foreground, fontSize: valueSize, weight: 'bold' })
  ]

  if (support.length) {
    children.push(gap(size === 'large' ? 20 : 10))
    if (size === 'small') {
      children.push(stack('horizontalStack', 'Supporting value', [
        staticText(support[0]!.label, { color: palette.muted, fontSize: 9, weight: 'medium' }),
        flexibleSpace(),
        variableText(support[0]!, { color: palette.accent, fontSize: 13, weight: 'semibold', alignment: 'trailing' })
      ]))
    } else {
      const footer: WidgetElement[] = []
      support.forEach((variable, index) => {
        if (index) footer.push(flexibleSpace())
        footer.push(metricColumn(variable, palette, size === 'large' ? 18 : 15, index === support.length - 1 ? 'trailing' : 'leading'))
      })
      children.push(stack('horizontalStack', 'Supporting values', footer))
    }
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 20 : 16, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildSymbol(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 3 : 1)
  let content: WidgetElement

  if (size === 'medium') {
    content = stack('horizontalStack', template.name, [
      stack('verticalStack', 'Symbol column', [
        symbolNode(context, palette.accent, 44),
        flexibleSpace(),
        dateNode(context.date, palette.muted, 10)
      ]),
      flexibleSpace(),
      stack('verticalStack', 'Value column', [
        staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium', alignment: 'trailing' }),
        gap(7),
        variableText(context.primary, { color: palette.foreground, fontSize: 34, alignment: 'trailing' }),
        ...(support[0] ? [gap(9), variableText(support[0], { color: palette.accent, fontSize: 14, weight: 'semibold', alignment: 'trailing' })] : [])
      ], { alignment: 'trailing' })
    ])
  } else {
    const rows: WidgetElement[] = []
    support.forEach((variable, index) => {
      if (index) rows.push(gap(12))
      rows.push(metricRow(variable, palette))
    })
    content = stack('verticalStack', template.name, [
      stack('horizontalStack', 'Header', [dateNode(context.date, palette.muted, 10), flexibleSpace(), symbolNode(context, palette.accent, size === 'large' ? 52 : 34)]),
      flexibleSpace(),
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' }),
      gap(5),
      variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 44 : 28 }),
      ...(rows.length ? [gap(size === 'large' ? 24 : 10), ...rows] : [])
    ])
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 16, content),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildSplit(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, size === 'large' ? 4 : 2)
  const first = selected[0]!
  const second = selected[1]
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [symbolNode(context, palette.accent, 16), flexibleSpace(), dateNode(context.date, palette.muted, 10)]),
    flexibleSpace()
  ]

  if (size === 'small') {
    children.push(metricColumn(first, palette, 25))
    if (second) children.push(gap(10), stack('horizontalStack', second.label, [
      staticText(second.label, { color: palette.muted, fontSize: 9, weight: 'medium' }),
      flexibleSpace(),
      variableText(second, { color: palette.accent, fontSize: 13, weight: 'semibold', alignment: 'trailing' })
    ]))
  } else {
    const columns: WidgetElement[] = []
    selected.slice(0, 2).forEach((variable, index) => {
      if (index) columns.push(flexibleSpace())
      columns.push(metricColumn(variable, palette, size === 'large' ? 30 : 27, index ? 'trailing' : 'leading'))
    })
    children.push(stack('horizontalStack', 'Primary pair', columns))
    selected.slice(2).forEach(variable => children.push(gap(18), metricRow(variable, palette)))
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 17, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildStrip(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, size === 'small' ? 2 : size === 'medium' ? 3 : 5)
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [
      staticText(context.primary.label, { color: palette.foreground, fontSize: 11 }),
      flexibleSpace(),
      symbolNode(context, palette.accent, 17)
    ]),
    gap(size === 'large' ? 26 : 12)
  ]

  if (size === 'small') {
    children.push(variableText(context.primary, { color: palette.foreground, fontSize: 29 }))
    if (selected[1]) children.push(flexibleSpace(), metricRow(selected[1], palette))
  } else {
    const stripChildren: WidgetElement[] = []
    selected.slice(0, 3).forEach((variable, index) => {
      if (index) stripChildren.push(flexibleSpace())
      stripChildren.push(metricColumn(variable, palette, index === 0 ? (size === 'large' ? 31 : 25) : (size === 'large' ? 19 : 15), index === selected.slice(0, 3).length - 1 ? 'trailing' : 'leading'))
    })
    children.push(stack('horizontalStack', 'Metric line', stripChildren))
    if (size === 'large') {
      selected.slice(3).forEach(variable => children.push(gap(20), metricRow(variable, palette)))
      children.push(flexibleSpace(), dateNode(context.date, palette.muted, 11))
    } else {
      children.push(flexibleSpace(), dateNode(context.date, palette.muted, 10))
    }
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 17, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildLedger(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, size === 'small' ? 2 : size === 'medium' ? 3 : 5)
  const rows: WidgetElement[] = []
  selected.forEach((variable, index) => {
    if (index) rows.push(gap(size === 'large' ? 16 : 10))
    rows.push(metricRow(variable, palette, index === 0))
  })
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [
      symbolNode(context, palette.accent, 18), gap(8),
      staticText(template.name, { color: palette.foreground, fontSize: 11 }),
      flexibleSpace(), dateNode(context.date, palette.muted, 10)
    ]),
    gap(size === 'large' ? 24 : 14),
    ...rows,
    flexibleSpace()
  ]
  return {
    root: widget(size, palette.background, size === 'large' ? 20 : 16, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildTicker(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 4 : size === 'medium' ? 2 : 1)
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [
      symbolNode(context, palette.accent, 18), gap(8),
      staticText(context.primary.label, { color: palette.accent, font: 'monospaced', fontSize: 10, weight: 'semibold' }),
      flexibleSpace(), dateNode(context.date, palette.muted, 10)
    ]),
    flexibleSpace(),
    variableText(context.primary, { color: palette.foreground, font: 'monospaced', fontSize: size === 'large' ? 43 : size === 'medium' ? 35 : 27, weight: 'bold' })
  ]

  if (support.length) {
    children.push(gap(size === 'large' ? 22 : 10))
    if (size === 'large') {
      support.forEach(variable => children.push(metricRow(variable, palette)))
    } else {
      const line: WidgetElement[] = []
      support.forEach((variable, index) => {
        if (index) line.push(flexibleSpace())
        line.push(stack('verticalStack', variable.label, [
          staticText(variable.label, { color: palette.muted, font: 'monospaced', fontSize: 9, weight: 'medium' }),
          gap(3),
          variableText(variable, { color: palette.accent, font: 'monospaced', fontSize: 13, weight: 'semibold' })
        ]))
      })
      children.push(stack('horizontalStack', 'Ticker values', line))
    }
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 21 : 16, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildEditorial(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 3 : size === 'medium' ? 2 : 1)
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Dateline', [
      dateNode(context.date, palette.muted, 10),
      flexibleSpace(),
      symbolNode(context, palette.accent, 15)
    ]),
    gap(size === 'large' ? 30 : 13),
    staticText(context.primary.label, { color: palette.accent, font: 'serif', fontSize: size === 'large' ? 17 : 13, weight: 'semibold' }),
    gap(6),
    variableText(context.primary, { color: palette.foreground, font: 'serif', fontSize: size === 'large' ? 46 : size === 'medium' ? 34 : 28, weight: 'bold' })
  ]

  if (support.length) {
    children.push(flexibleSpace())
    if (size === 'small') {
      children.push(staticText(support[0]!.label, { color: palette.muted, fontSize: 9, weight: 'medium' }), gap(3), variableText(support[0]!, { color: palette.foreground, fontSize: 13, weight: 'medium' }))
    } else {
      support.forEach((variable, index) => {
        if (index) children.push(gap(size === 'large' ? 14 : 8))
        children.push(metricRow(variable, palette))
      })
    }
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 24 : 17, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildBand(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 4 : size === 'medium' ? 2 : 1)
  const top = stack('verticalStack', 'Primary area', [
    stack('horizontalStack', 'Header', [
      symbolNode(context, palette.accent, 18),
      flexibleSpace(),
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' })
    ]),
    flexibleSpace(),
    variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 46 : size === 'medium' ? 35 : 28 })
  ], { padding: size === 'large' ? 21 : 16 })

  const bandChildren: WidgetElement[] = []
  if (support.length) {
    support.forEach((variable, index) => {
      if (index) bandChildren.push(flexibleSpace())
      bandChildren.push(stack('verticalStack', variable.label, [
        staticText(variable.label, { color: palette.accentForeground, fontSize: 9, weight: 'medium', opacity: 0.72, alignment: index === support.length - 1 ? 'trailing' : 'leading' }),
        gap(3),
        variableText(variable, { color: palette.accentForeground, fontSize: size === 'large' ? 16 : 13, weight: 'semibold', alignment: index === support.length - 1 ? 'trailing' : 'leading' })
      ], { alignment: index === support.length - 1 ? 'trailing' : 'leading' }))
    })
  } else {
    bandChildren.push(dateNode(context.date, palette.accentForeground, 10))
  }
  const band = stack('horizontalStack', 'Supporting band', bandChildren, {
    padding: size === 'large' ? 18 : 13,
    backgroundColor: palette.accent
  })
  const root = widget(size, palette.background, 0, stack('verticalStack', template.name, [top, band]))
  return { root, usedPaths: uniquePaths([context.primary, ...support, context.date]) }
}

function buildHorizontal(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 4 : size === 'medium' ? 2 : 1)
  let content: WidgetElement

  if (size === 'small') {
    const left = stack('verticalStack', 'Primary column', [
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' }),
      gap(5),
      variableText(context.primary, { color: palette.foreground, fontSize: 28 }),
      ...(support[0] ? [flexibleSpace(), staticText(support[0].label, { color: palette.muted, fontSize: 9, weight: 'medium' }), gap(3), variableText(support[0], { color: palette.accent, fontSize: 13, weight: 'semibold' })] : [])
    ])
    const right = stack('verticalStack', 'Symbol column', [
      symbolNode(context, palette.accent, 30),
      flexibleSpace(),
      dateNode(context.date, palette.muted, 9)
    ], { alignment: 'trailing' })
    content = stack('horizontalStack', template.name, [left, flexibleSpace(), right])
  } else if (size === 'medium') {
    const right: WidgetElement[] = []
    support.forEach((variable, index) => {
      if (index) right.push(gap(11))
      right.push(metricColumn(variable, palette, 15, 'trailing'))
    })
    content = stack('horizontalStack', template.name, [
      stack('verticalStack', 'Primary column', [
        stack('horizontalStack', 'Primary label', [symbolNode(context, palette.accent, 17), gap(7), staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' })]),
        flexibleSpace(),
        variableText(context.primary, { color: palette.foreground, fontSize: 38 }),
        gap(7),
        dateNode(context.date, palette.muted, 10)
      ]),
      flexibleSpace(),
      stack('verticalStack', 'Supporting stack', right.length ? right : [symbolNode(context, palette.accent, 38)], { alignment: 'trailing' })
    ])
  } else {
    const rows: WidgetElement[] = []
    support.forEach((variable, index) => {
      if (index) rows.push(gap(17))
      rows.push(metricRow(variable, palette))
    })
    content = stack('verticalStack', template.name, [
      stack('horizontalStack', 'Primary overview', [
        stack('verticalStack', 'Primary value', [
          staticText(context.primary.label, { color: palette.muted, fontSize: 11, weight: 'medium' }),
          gap(8),
          variableText(context.primary, { color: palette.foreground, fontSize: 48 })
        ]),
        flexibleSpace(),
        symbolNode(context, palette.accent, 62)
      ]),
      gap(28),
      ...rows,
      flexibleSpace(),
      dateNode(context.date, palette.muted, 11)
    ])
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 16, content),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildCenter(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 3 : size === 'medium' ? 2 : 1)
  const children: WidgetElement[] = [
    flexibleSpace(),
    symbolNode(context, palette.accent, size === 'large' ? 44 : size === 'medium' ? 30 : 24),
    gap(size === 'large' ? 16 : 9),
    staticText(context.primary.label, { color: palette.muted, fontSize: size === 'large' ? 12 : 10, weight: 'medium', alignment: 'center' }),
    gap(5),
    variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 50 : size === 'medium' ? 39 : 29, alignment: 'center' })
  ]

  if (support.length) {
    children.push(gap(size === 'large' ? 24 : 11))
    const line: WidgetElement[] = []
    support.forEach((variable, index) => {
      if (index) line.push(flexibleSpace())
      line.push(metricColumn(variable, palette, size === 'large' ? 17 : 13, 'center'))
    })
    children.push(stack('horizontalStack', 'Centered supporting values', line))
  }
  children.push(flexibleSpace(), dateNode(context.date, palette.muted, 9))

  return {
    root: widget(size, palette.background, size === 'large' ? 24 : 17, stack('verticalStack', template.name, children, { alignment: 'center' })),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildMatrix(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, 4)
  const rows: WidgetElement[] = []

  for (let index = 0; index < selected.length; index += 2) {
    const pair = selected.slice(index, index + 2)
    const row: WidgetElement[] = []
    pair.forEach((variable, pairIndex) => {
      if (pairIndex) row.push(flexibleSpace())
      row.push(metricColumn(variable, palette, size === 'large' ? (index === 0 ? 27 : 21) : size === 'medium' ? 19 : 14, pairIndex ? 'trailing' : 'leading'))
    })
    if (rows.length) rows.push(gap(size === 'large' ? 30 : 14))
    rows.push(stack('horizontalStack', `Matrix row ${index / 2 + 1}`, row))
  }

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 16, stack('verticalStack', template.name, [
      stack('horizontalStack', 'Header', [
        staticText(template.name, { color: palette.foreground, fontSize: 11 }),
        flexibleSpace(),
        dateNode(context.date, palette.muted, 10)
      ]),
      gap(size === 'large' ? 30 : 16),
      ...rows,
      flexibleSpace(),
      stack('horizontalStack', 'Footer symbol', [flexibleSpace(), symbolNode(context, palette.accent, size === 'large' ? 24 : 16)])
    ])),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildRail(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 4 : size === 'medium' ? 2 : 1)
  let content: WidgetElement

  if (size === 'small') {
    const rail = stack('horizontalStack', 'Top rail', [
      symbolNode(context, palette.accentForeground, 18),
      flexibleSpace(),
      dateNode(context.date, palette.accentForeground, 9)
    ], { padding: 11, backgroundColor: palette.accent })
    const body: WidgetElement[] = [
      staticText(context.primary.label, { color: palette.muted, fontSize: 9, weight: 'medium' }),
      gap(5),
      variableText(context.primary, { color: palette.foreground, fontSize: 27 }),
      flexibleSpace()
    ]
    if (support[0]) body.push(metricRow(support[0], palette))
    content = stack('verticalStack', template.name, [rail, stack('verticalStack', 'Rail content', body, { padding: 14 })])
  } else {
    const rail = stack('verticalStack', 'Edge rail', [
      symbolNode(context, palette.accentForeground, size === 'large' ? 30 : 22),
      flexibleSpace(),
      dateNode(context.date, palette.accentForeground, 9)
    ], { padding: size === 'large' ? 18 : 14, backgroundColor: palette.accent })
    const body: WidgetElement[] = [
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium', alignment: 'trailing' }),
      gap(6),
      variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 45 : 34, alignment: 'trailing' }),
      flexibleSpace()
    ]
    support.forEach((variable, index) => {
      if (index) body.push(gap(size === 'large' ? 14 : 8))
      body.push(metricRow(variable, palette))
    })
    content = stack('horizontalStack', template.name, [
      rail,
      flexibleSpace(),
      stack('verticalStack', 'Rail content', body, { alignment: 'trailing', padding: size === 'large' ? 22 : 17 })
    ])
  }

  return {
    root: widget(size, palette.background, 0, content),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildStacked(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, size === 'large' ? 5 : 3)
  const valueSizes = size === 'large' ? [34, 25, 20, 17, 15] : size === 'medium' ? [24, 18, 15] : [21, 16, 13]
  const blocks: WidgetElement[] = []
  selected.forEach((variable, index) => {
    if (index) blocks.push(gap(size === 'large' ? 16 : 8))
    blocks.push(stack('verticalStack', `${variable.label} block`, [
      staticText(variable.label, { color: palette.muted, fontSize: index === 0 ? 10 : 9, weight: 'medium' }),
      gap(3),
      variableText(variable, { color: index === 0 ? palette.accent : palette.foreground, fontSize: valueSizes[index] || 14, weight: index === 0 ? 'bold' : 'semibold' })
    ]))
  })
  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 16, stack('verticalStack', template.name, [
      stack('horizontalStack', 'Header', [symbolNode(context, palette.accent, 17), flexibleSpace(), dateNode(context.date, palette.muted, 10)]),
      gap(size === 'large' ? 25 : 12),
      ...blocks,
      flexibleSpace()
    ])),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildCorner(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const support = context.supporting.slice(0, size === 'large' ? 2 : 1)
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [
      staticText(context.primary.label, { color: palette.muted, fontSize: 10, weight: 'medium' }),
      flexibleSpace(),
      dateNode(context.date, palette.muted, 10)
    ]),
    flexibleSpace()
  ]
  support.forEach(variable => children.push(metricRow(variable, palette)))
  if (support.length) children.push(gap(size === 'large' ? 22 : 10))
  children.push(stack('horizontalStack', 'Corner composition', [
    variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 54 : size === 'medium' ? 40 : 29 }),
    flexibleSpace(),
    symbolNode(context, palette.accent, size === 'large' ? 66 : size === 'medium' ? 50 : 36)
  ]))

  return {
    root: widget(size, palette.background, size === 'large' ? 23 : 16, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([context.primary, ...support, context.date])
  }
}

function buildTriptych(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const selected = [context.primary, ...context.supporting].slice(0, size === 'large' ? 5 : 3)
  const columns: WidgetElement[] = []
  selected.slice(0, 3).forEach((variable, index) => {
    if (index) columns.push(flexibleSpace())
    columns.push(metricColumn(variable, palette, size === 'large' ? 24 : size === 'medium' ? (index === 0 ? 22 : 16) : 13, 'center'))
  })
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Header', [symbolNode(context, palette.accent, 16), flexibleSpace(), dateNode(context.date, palette.muted, 10)]),
    flexibleSpace(),
    stack('horizontalStack', 'Three columns', columns)
  ]
  selected.slice(3).forEach(variable => children.push(gap(20), metricRow(variable, palette)))
  if (size === 'large') children.push(flexibleSpace())

  return {
    root: widget(size, palette.background, size === 'large' ? 22 : 16, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([...selected, context.date])
  }
}

function buildMinimal(template: WidgetTemplate, context: TemplateContext): BuiltWidgetTemplate {
  const { size, palette } = template
  const children: WidgetElement[] = [
    stack('horizontalStack', 'Dateline', [dateNode(context.date, palette.muted, 10), flexibleSpace()]),
    flexibleSpace(),
    staticText(context.primary.label, { color: palette.muted, fontSize: size === 'large' ? 13 : 10, weight: 'medium' }),
    gap(size === 'large' ? 10 : 6),
    variableText(context.primary, { color: palette.foreground, fontSize: size === 'large' ? 58 : size === 'medium' ? 46 : 34, weight: 'bold' }),
    flexibleSpace(),
    stack('horizontalStack', 'Symbol footer', [flexibleSpace(), symbolNode(context, palette.accent, size === 'large' ? 24 : 17)])
  ]
  return {
    root: widget(size, palette.background, size === 'large' ? 25 : 17, stack('verticalStack', template.name, children)),
    usedPaths: uniquePaths([context.primary, context.date])
  }
}

export function buildWidgetTemplate(
  template: WidgetTemplate,
  document: EditorDocument,
  options: TemplateContentOptions = {}
): BuiltWidgetTemplate {
  const context = limitTemplateContext(getTemplateContext(document), template.size)
  if (isCountdownContext(context)) return buildCountdown(template, context, options)
  if (template.recipe === 'focus') return buildFocus(template, context)
  if (template.recipe === 'symbol') return buildSymbol(template, context)
  if (template.recipe === 'split') return buildSplit(template, context)
  if (template.recipe === 'strip') return buildStrip(template, context)
  if (template.recipe === 'ledger') return buildLedger(template, context)
  if (template.recipe === 'ticker') return buildTicker(template, context)
  if (template.recipe === 'editorial') return buildEditorial(template, context)
  if (template.recipe === 'band') return buildBand(template, context)
  if (template.recipe === 'horizontal') return buildHorizontal(template, context)
  if (template.recipe === 'center') return buildCenter(template, context)
  if (template.recipe === 'matrix') return buildMatrix(template, context)
  if (template.recipe === 'rail') return buildRail(template, context)
  if (template.recipe === 'stacked') return buildStacked(template, context)
  if (template.recipe === 'corner') return buildCorner(template, context)
  if (template.recipe === 'triptych') return buildTriptych(template, context)
  return buildMinimal(template, context)
}

function preserveSharedSettings(root: WidgetElement, source: WidgetProperties) {
  Object.assign(root.properties as WidgetProperties, {
    refreshInterval: source.refreshInterval,
    tapUrl: source.tapUrl
  })
}

export function applyWidgetTemplate(
  template: WidgetTemplate,
  document: EditorDocument,
  options: TemplateContentOptions = {}
) {
  const shared = document.layouts.medium.properties as WidgetProperties
  const built = buildWidgetTemplate(template, document, options)
  preserveSharedSettings(built.root, shared)
  document.layouts[template.size] = built.root
  document.activeSize = template.size
  document.enabledSizes[template.size] = true
  document.data.selectedPaths = [...new Set([...document.data.selectedPaths, ...built.usedPaths])]
  return built
}

export function applyAdaptiveTemplateSet(
  document: EditorDocument,
  generation = 0,
  options: TemplateContentOptions = {}
) {
  const shared = document.layouts.medium.properties as WidgetProperties
  const layouts = {} as EditorDocument['layouts']
  const usedPaths = new Set<string>()

  ;(['small', 'medium', 'large'] as PreviewSize[]).forEach((size, index) => {
    const template = generateWidgetTemplateOptions(document, size, generation + index, 1)[0]!
    const built = buildWidgetTemplate(template, document, options)
    preserveSharedSettings(built.root, shared)
    layouts[size] = built.root
    built.usedPaths.forEach(path => usedPaths.add(path))
  })

  document.layouts = layouts
  document.activeSize = 'medium'
  document.enabledSizes = { small: true, medium: true, large: true }
  document.data.selectedPaths = [...new Set([...document.data.selectedPaths, ...usedPaths])]
  return { layouts, usedPaths: [...usedPaths] }
}
