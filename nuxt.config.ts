export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'scriptable-studio-color-mode'
  },
  fonts: {
    families: [
      { name: 'Spline Sans', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600] }
    ]
  },
  app: {
    head: {
      title: 'Scriptable Widget Studio',
      meta: [
        {
          name: 'description',
          content: 'Build Scriptable widgets visually and export readable JavaScript.'
        }
      ]
    }
  },
  ui: {
    experimental: {
      componentDetection: true
    }
  },
  compatibilityDate: '2026-07-14'
})
