import type { DataTransform, EditorDocument, StackProperties, TextProperties, WidgetProperties } from '~/types/editor'
import { createDocument, createElement, createId } from '~/utils/editor'
import { applyAdaptiveTemplateSet } from '~/utils/templates'

export type WidgetStarterId = 'bitcoin' | 'expenses' | 'countdown' | 'blank'

export const GTA_COUNTDOWN_IMAGE_URL = 'https://www.pcgamesn.com/wp-content/sites/pcgamesn/2025/05/gta-6-release-date-550x309.jpg'

export interface WidgetStarter {
  id: WidgetStarterId
  name: string
  projectName: string
  description: string
  sourceLabel: string
  icon: string
  accentClass: string
}

export const WIDGET_STARTERS: WidgetStarter[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin price',
    projectName: 'Bitcoin price',
    description: 'Reads the current BTC–USD spot price from Coinbase.',
    sourceLabel: 'Live API',
    icon: 'i-lucide-bitcoin',
    accentClass: 'bg-[#f7931a] text-[#21170b]'
  },
  {
    id: 'expenses',
    name: 'Expense tracker',
    projectName: 'Expense tracker',
    description: 'Accepts purchases from Apple Shortcuts and totals them.',
    sourceLabel: 'Shortcuts',
    icon: 'i-lucide-receipt-indian-rupee',
    accentClass: 'bg-[#63d5a5] text-[#10231e]'
  },
  {
    id: 'countdown',
    name: 'GTA VI countdown',
    projectName: 'GTA VI countdown',
    description: 'Counts down to November 19, 2026 from the current time.',
    sourceLabel: 'Date math',
    icon: 'i-lucide-timer',
    accentClass: 'bg-[#ff7a59] text-[#32170f]'
  },
  {
    id: 'blank',
    name: 'Build your own',
    projectName: 'Untitled widget',
    description: 'Start visually with an editable label and value, then connect data whenever you want.',
    sourceLabel: 'Visual first',
    icon: 'i-lucide-shapes',
    accentClass: 'bg-primary text-inverted'
  }
]

function transform(
  operation: DataTransform['operation'],
  outputKey: string,
  sourcePath: string,
  valuePath = ''
): DataTransform {
  return {
    id: createId('transform'),
    operation,
    outputKey,
    sourcePath,
    valuePath
  }
}

function setSharedBehavior(document: EditorDocument, refreshInterval: number, tapUrl: string) {
  Object.values(document.layouts).forEach((layout) => {
    Object.assign(layout.properties as WidgetProperties, { refreshInterval, tapUrl })
  })
}

function finishStarter(document: EditorDocument) {
  applyAdaptiveTemplateSet(document)
  document.activeSize = 'medium'
  return document
}

function bitcoinDocument() {
  const document = createDocument()
  document.data = {
    fileName: 'bitcoin-price.json',
    sampleData: {
      data: {
        amount: '64596.595',
        base: 'BTC',
        currency: 'USD'
      }
    },
    selectedPaths: ['bitcoinPriceUsd', 'data.base', 'data.currency'],
    source: {
      kind: 'http-json',
      url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot'
    },
    transforms: [transform('number', 'bitcoinPriceUsd', 'data.amount')],
    sampledAt: '2026-07-14T18:48:39.000Z'
  }
  setSharedBehavior(document, 5, 'https://www.coinbase.com/price/bitcoin')
  return finishStarter(document)
}

function expenseDocument() {
  const document = createDocument()
  document.data = {
    fileName: 'expense-tracker.json',
    sampleData: {
      transactions: [
        { amount: 480, merchant: 'Lunch', timestamp: '2026-07-14T08:10:00.000Z' },
        { amount: 1040, merchant: 'Groceries', timestamp: '2026-07-14T11:45:00.000Z' }
      ]
    },
    selectedPaths: ['totalSpendInr', 'transactionCount', 'latestTransaction.merchant'],
    source: {
      kind: 'shortcut',
      updateMode: 'append',
      appendKey: 'transactions'
    },
    transforms: [
      transform('sum', 'totalSpendInr', 'transactions', 'amount'),
      transform('count', 'transactionCount', 'transactions'),
      transform('last', 'latestTransaction', 'transactions')
    ],
    sampledAt: '2026-07-14T11:45:00.000Z'
  }
  setSharedBehavior(document, 30, '')
  return finishStarter(document)
}

function countdownDocument() {
  const document = createDocument()
  document.data = {
    fileName: 'gta-vi-countdown.json',
    sampleData: {
      eventTitle: 'Grand Theft Auto VI',
      targetDate: '2026-11-19T00:00:00',
      backgroundImageUrl: GTA_COUNTDOWN_IMAGE_URL
    },
    selectedPaths: ['daysToGo', 'hoursRemaining', 'minutesRemaining', 'eventTitle', 'backgroundImageUrl'],
    source: { kind: 'snapshot' },
    transforms: [
      transform('days-until', 'daysToGo', 'targetDate'),
      transform('hours-until', 'hoursRemaining', 'targetDate'),
      transform('minutes-until', 'minutesRemaining', 'targetDate')
    ],
    sampledAt: '2026-07-15T00:00:00.000+05:30'
  }
  setSharedBehavior(document, 15, 'https://www.rockstargames.com/VI/')
  return finishStarter(document)
}

function visualDocument() {
  const document = createDocument()
  document.data = {
    fileName: 'widget-data.json',
    sampleData: {
      label: 'Edit this label',
      value: 'Edit this value'
    },
    selectedPaths: ['label', 'value'],
    source: { kind: 'snapshot' },
    transforms: []
  }

  Object.entries(document.layouts).forEach(([size, root]) => {
    const row = createElement('horizontalStack')
    row.name = 'Dashboard row'
    Object.assign(row.properties as StackProperties, {
      alignment: 'leading',
      spacing: size === 'small' ? 8 : 14
    })

    const content = createElement('verticalStack')
    content.name = 'Dashboard item'
    Object.assign(content.properties as StackProperties, {
      alignment: 'leading',
      spacing: size === 'small' ? 7 : 9
    })

    const label = createElement('text')
    label.name = 'Label'
    Object.assign(label.properties as TextProperties, {
      contentMode: 'variable',
      variable: 'label',
      fontSize: size === 'small' ? 11 : 12,
      weight: 'semibold',
      color: '#a5b4fc',
      opacity: 1,
      lineLimit: 1
    })

    const value = createElement('text')
    value.name = 'Value'
    Object.assign(value.properties as TextProperties, {
      contentMode: 'variable',
      variable: 'value',
      font: 'rounded',
      fontSize: size === 'small' ? 25 : size === 'medium' ? 31 : 36,
      weight: 'bold',
      color: '#ffffff',
      opacity: 1,
      lineLimit: size === 'large' ? 3 : 2,
      minimumScaleFactor: 0.55
    })

    content.children = [label, value]
    row.children = [content]
    root.children = [row]
  })

  document.activeSize = 'medium'
  return document
}

export function createWidgetStarterDocument(id: WidgetStarterId) {
  if (id === 'bitcoin') return bitcoinDocument()
  if (id === 'expenses') return expenseDocument()
  if (id === 'countdown') return countdownDocument()
  return visualDocument()
}

export function getWidgetStarter(id: WidgetStarterId) {
  return WIDGET_STARTERS.find(starter => starter.id === id) ?? WIDGET_STARTERS.at(-1)!
}
