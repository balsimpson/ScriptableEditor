export type ElementType =
  | 'widget'
  | 'verticalStack'
  | 'horizontalStack'
  | 'spacer'
  | 'text'
  | 'image'
  | 'date'

export type PreviewSize = 'small' | 'medium' | 'large'
export type HorizontalAlignment = 'leading' | 'center' | 'trailing'
export type FontFamily = 'system' | 'rounded' | 'serif' | 'monospaced'
export type FontWeight = 'ultralight' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black'

export interface NumberFormatOptions {
  round: boolean
  decimals: number
  currency: string
  prefix: string
  suffix: string
  percentage: boolean
  textCase: 'none' | 'uppercase' | 'lowercase'
  dateFormat: string
  fallback: string
  compact?: boolean
}

export interface WidgetProperties {
  backgroundColor: string
  backgroundOpacity: number
  backgroundImageMode: 'none' | 'static' | 'variable'
  backgroundImageUrl: string
  backgroundImageVariable: string
  backgroundImageFallbackUrl: string
  padding: number
  refreshInterval: number
  previewSize: PreviewSize
  tapUrl: string
}

export interface StackProperties {
  alignment: HorizontalAlignment
  spacing: number
  backgroundColor: string
  padding: number
  cornerRadius: number
  borderWidth: number
  borderColor: string
  repeatCount: number
}

export interface TextProperties {
  contentMode: 'static' | 'variable'
  content: string
  variable: string
  font: FontFamily
  fontSize: number
  weight: FontWeight
  color: string
  alignment: HorizontalAlignment
  opacity: number
  lineLimit: number
  minimumScaleFactor: number
  format: NumberFormatOptions
}

export interface ImageProperties {
  sourceType: 'symbol' | 'remote'
  systemSymbol: string
  remoteUrl: string
  remoteMode: 'static' | 'variable'
  variable: string
  fallbackUrl: string
  width: number
  height: number
  tintColor: string
  cornerRadius: number
  opacity: number
  contentMode: 'fit' | 'fill'
}

export interface DateProperties {
  dateFormat: string
  relativeDate: boolean
  sourceType: 'now' | 'variable'
  variable: string
  fallback: string
  color: string
  font: FontFamily
  fontSize: number
  weight: FontWeight
}

export interface SpacerProperties {
  mode: 'fixed' | 'flexible'
  size: number
}

export type ElementProperties =
  | WidgetProperties
  | StackProperties
  | TextProperties
  | ImageProperties
  | DateProperties
  | SpacerProperties

export interface WidgetElement {
  id: string
  type: ElementType
  name: string
  properties: ElementProperties
  children: WidgetElement[]
  collapsed?: boolean
}

export interface JsonDataModel {
  fileName: string
  sampleData?: unknown
  selectedPaths: string[]
  source: WidgetDataSource
  transforms: DataTransform[]
  sampledAt?: string
}

export interface EditorDocument {
  version: 5
  activeSize: PreviewSize
  enabledSizes: Record<PreviewSize, boolean>
  layouts: Record<PreviewSize, WidgetElement>
  data: JsonDataModel
}

export type WidgetDataSource =
  | {
      kind: 'http-json'
      url: string
    }
  | {
      kind: 'shortcut'
      updateMode: 'overwrite' | 'merge' | 'append'
      appendKey: string
    }
  | {
      kind: 'snapshot'
    }

export type DataTransformOperation =
  | 'copy'
  | 'number'
  | 'count'
  | 'sum'
  | 'first'
  | 'last'
  | 'days-until'
  | 'hours-until'
  | 'minutes-until'

export interface DataTransform {
  id: string
  outputKey: string
  operation: DataTransformOperation
  sourcePath: string
  valuePath: string
}

export interface DataDiscoveryBundle {
  format: 'scriptable-widget-data-snapshot'
  version: 1
  source: WidgetDataSource
  sample: unknown
  observedAt: string
}

export interface VariableOption {
  label: string
  value: string
  preview: unknown
}

export interface JsonLeaf {
  path: string
  value: unknown
  type: string
}
