import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, transform } from 'esbuild'

const workspace = process.cwd()

async function loadStudioModules() {
  const result = await build({
    stdin: {
      contents: [
        'export { generateScriptableCode, getScriptableExportIssues } from "./app/utils/scriptable.ts"',
        'export { generateUniversalDataProbeCode } from "./app/utils/data.ts"',
        'export { createDocument, createElement } from "./app/utils/editor.ts"',
        'export { createWidgetStarterDocument } from "./app/utils/starters.ts"'
      ].join('\n'),
      resolveDir: workspace,
      sourcefile: 'scriptable-test-entry.ts'
    },
    alias: { '~': path.join(workspace, 'app') },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    write: false
  })
  const source = result.outputFiles[0].text
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(url)
}

const studio = await loadStudioModules()

function onlyMedium(document) {
  document.enabledSizes = { small: false, medium: true, large: false }
  document.activeSize = 'medium'
  return document
}

function installScriptableMocks({ family = 'medium', runsInWidget = true, runsWithSiri = false, shortcutParameter = null } = {}) {
  const state = { widget: null, shortcutOutput: null, complete: false }

  class MockNode {
    constructor(type = 'node', value = '') {
      this.type = type
      this.value = value
      this.children = []
    }

    addStack() {
      const node = new MockNode('stack')
      this.children.push(node)
      return node
    }

    addText(value) {
      const node = new MockNode('text', value)
      this.children.push(node)
      return node
    }

    addDate(value) {
      const node = new MockNode('date', value)
      this.children.push(node)
      return node
    }

    addImage(value) {
      const node = new MockNode('image', value)
      this.children.push(node)
      return node
    }

    addSpacer() { this.children.push(new MockNode('spacer')) }
    layoutVertically() {}
    layoutHorizontally() {}
    centerAlignContent() {}
    setPadding() {}
    leftAlignText() {}
    centerAlignText() {}
    rightAlignText() {}
    applyRelativeStyle() {}
    applyFittingContentMode() {}
    applyFillingContentMode() {}
    async presentSmall() {}
    async presentMedium() {}
    async presentLarge() {}
  }

  globalThis.ListWidget = class extends MockNode {}
  globalThis.Color = class {
    constructor(hex, alpha = 1) { this.hex = hex; this.alpha = alpha }
    static white() { return new this('#ffffff') }
  }
  globalThis.Font = new Proxy(class {}, { get: () => () => ({}) })
  globalThis.Size = class { constructor(width, height) { this.width = width; this.height = height } }
  globalThis.DateFormatter = class { string(value) { return String(value) } }
  globalThis.SFSymbol = { named: name => name ? { image: { name }, applyFont() {} } : null }
  globalThis.URLScheme = { forOpeningScript: () => 'scriptable:///open/Test' }
  globalThis.FileManager = {
    local: () => ({
      documentsDirectory: () => '/tmp',
      joinPath: (left, right) => `${left}/${right}`,
      fileExists: () => false,
      readString: () => '',
      writeString: () => {},
      remove: () => {}
    })
  }
  globalThis.Script = {
    name: () => 'Generated test',
    setWidget: widget => { state.widget = widget },
    setShortcutOutput: value => { state.shortcutOutput = value },
    complete: () => { state.complete = true }
  }
  globalThis.config = { runsInWidget, runsWithSiri, widgetFamily: family }
  globalThis.args = { shortcutParameter }
  globalThis.Alert = class extends MockNode { addAction() {}; async presentAlert() { return 0 } }
  globalThis.Request = class { constructor(url) { this.url = url } }
  globalThis.Data = { fromPNG: () => ({ toBase64String: () => '' }), fromBase64String: () => ({}) }
  globalThis.Image = { fromData: () => ({}) }
  globalThis.WebView = class { async loadHTML() {}; async evaluateJavaScript() { return null } }

  return state
}

async function executeGenerated(code, options) {
  const state = installScriptableMocks(options)
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${Math.random()}`
  await import(url)
  return state
}

test('all starter scripts are valid JavaScript', async () => {
  for (const id of ['bitcoin', 'expenses', 'countdown', 'blank']) {
    const document = studio.createWidgetStarterDocument(id)
    assert.equal(studio.getScriptableExportIssues(document).some(issue => issue.severity === 'error'), false)
    const code = studio.generateScriptableCode(document, { projectId: `project-${id}`, projectName: id })
    await transform(code, { loader: 'js', format: 'esm', target: 'esnext' })
    assert.match(code, /request\.timeoutInterval = 15/)
    assert.match(code, /function renderErrorWidget/)
  }
  await transform(studio.generateUniversalDataProbeCode(), { loader: 'js', format: 'esm', target: 'esnext' })
})

test('Bitcoin export uses a visible configured SF Symbol', () => {
  const document = studio.createWidgetStarterDocument('bitcoin')
  const code = studio.generateScriptableCode(document, { projectId: 'bitcoin-symbol' })

  assert.match(code, /requireSystemSymbol\("bitcoinsign\.circle"/)
  assert.doesNotMatch(code, /requireSystemSymbol\("bitcoinsign\.circle\.fill"/)
  assert.match(code, /Symbol\.applyFont\(Font\.systemFont\(\d+\)\)/)
})

test('GTA VI countdown uses its artwork as an exported background', () => {
  const document = studio.createWidgetStarterDocument('countdown')
  const backgrounds = Object.values(document.layouts).map(layout => layout.properties)

  assert.ok(backgrounds.every(properties => properties.backgroundImageMode === 'variable'))
  assert.ok(backgrounds.every(properties => properties.backgroundImageVariable === 'backgroundImageUrl'))

  const code = studio.generateScriptableCode(document, { projectId: 'gta-countdown-artwork' })
  assert.match(code, /gta-6-release-date-550x309\.jpg/)
  assert.match(code, /widget\.backgroundImage = visibleBackgroundImage/)
})

test('GTA VI countdown keeps days, hours, and minutes in one timer row', () => {
  const document = studio.createWidgetStarterDocument('countdown')

  for (const layout of Object.values(document.layouts)) {
    const timer = (() => {
      const queue = [layout]
      while (queue.length) {
        const element = queue.shift()
        if (element.name === 'Countdown timer') return element
        queue.push(...element.children)
      }
    })()
    assert.equal(timer?.type, 'horizontalStack')

    const variables = []
    const queue = [...timer.children]
    while (queue.length) {
      const element = queue.shift()
      if (element.type === 'text' && element.properties.contentMode === 'variable') variables.push(element.properties.variable)
      queue.push(...element.children)
    }
    assert.deepEqual(variables, ['daysToGo', 'hoursRemaining', 'minutesRemaining'])
  }
})

test('GTA VI countdown uses editable flexible spacing between timer units', () => {
  const document = studio.createWidgetStarterDocument('countdown')
  const code = studio.generateScriptableCode(document, {
    projectId: 'gta-countdown-gaps'
  })

  for (const layout of Object.values(document.layouts)) {
    const timer = (() => {
      const queue = [layout]
      while (queue.length) {
        const element = queue.shift()
        if (element.name === 'Countdown timer') return element
        queue.push(...element.children)
      }
    })()
    const separators = timer.children.filter(element => element.type === 'spacer')
    assert.equal(separators.length, 2)
    assert.ok(separators.every(element => element.properties.mode === 'flexible'))
  }

  assert.equal((code.match(/countdownTimer\d+\.addSpacer\(null\)/g) || []).length, 6)
  assert.doesNotMatch(code, /countdownTimer\d+\.addSpacer\(\)/)
  assert.equal((code.match(/daysTimerUnitAlignment\d+\.addSpacer\(\)/g) || []).length, 12)
  assert.equal((code.match(/hoursTimerUnitAlignment\d+\.addSpacer\(\)/g) || []).length, 12)
  assert.equal((code.match(/minTimerUnitAlignment\d+\.addSpacer\(\)/g) || []).length, 12)
})

test('generated images and stack alignment preserve editor settings', () => {
  const document = onlyMedium(studio.createDocument())
  const stack = studio.createElement('verticalStack')
  stack.name = 'Trailing column'
  stack.properties.alignment = 'trailing'
  const image = studio.createElement('image')
  image.name = 'Hero image'
  Object.assign(image.properties, {
    sourceType: 'remote',
    remoteMode: 'static',
    remoteUrl: 'https://example.com/image.png',
    opacity: 0.4,
    contentMode: 'fill'
  })
  stack.children = [image]
  document.layouts.medium.children = [stack]

  const code = studio.generateScriptableCode(document, { projectId: 'alignment-test' })
  assert.match(code, /Alignment\d+\.addSpacer\(\)/)
  assert.match(code, /\.imageOpacity = 0\.4/)
  assert.match(code, /\.applyFillingContentMode\(\)/)
})

test('export preflight ignores bindings from disabled sizes', () => {
  const document = onlyMedium(studio.createDocument())
  const text = studio.createElement('text')
  Object.assign(text.properties, { contentMode: 'variable', variable: 'missing.value' })
  document.layouts.small.children = [text]

  assert.equal(studio.getScriptableExportIssues(document).some(issue => issue.code === 'DATA-001'), false)
  document.enabledSizes.small = true
  assert.equal(studio.getScriptableExportIssues(document).some(issue => issue.code === 'DATA-001'), true)
})

test('unsafe cache names block export', () => {
  const document = studio.createDocument()
  document.data.fileName = '../shared.json'
  const issue = studio.getScriptableExportIssues(document).find(item => item.code === 'CACHE-001')
  assert.equal(issue?.severity, 'error')
})

test('snapshot widget renders and completes in a mocked Scriptable runtime', async () => {
  const document = onlyMedium(studio.createWidgetStarterDocument('blank'))
  const state = await executeGenerated(studio.generateScriptableCode(document, { projectId: 'runtime-success' }))
  assert.ok(state.widget)
  assert.equal(state.complete, true)
})

test('missing runtime data renders an informative error widget', async () => {
  const document = onlyMedium(studio.createDocument())
  const text = studio.createElement('text')
  text.name = 'Price'
  Object.assign(text.properties, { contentMode: 'variable', variable: 'data.amount' })
  document.layouts.medium.children = [text]
  document.data.sampleData = {}

  const state = await executeGenerated(studio.generateScriptableCode(document, { projectId: 'runtime-error' }))
  const renderedText = state.widget.children.filter(child => child.type === 'text').map(child => child.value).join(' ')
  assert.match(renderedText, /DATA-004/)
  assert.match(renderedText, /Required field/)
  assert.equal(state.complete, true)
})

test('Shortcut without input returns a structured failure', async () => {
  const document = onlyMedium(studio.createWidgetStarterDocument('expenses'))
  const state = await executeGenerated(studio.generateScriptableCode(document, { projectId: 'shortcut-error' }), {
    runsInWidget: false,
    runsWithSiri: true,
    shortcutParameter: null
  })
  assert.equal(state.shortcutOutput.ok, false)
  assert.equal(state.shortcutOutput.error.code, 'SHORTCUT-001')
  assert.equal(state.complete, true)
})

test.after(() => {
  // Keep the file URL import visible to Node's module loader in coverage/debug output.
  assert.ok(pathToFileURL(workspace).href)
})
