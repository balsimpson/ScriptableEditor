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
      htmlAttrs: {
        lang: 'en'
      },
      title: 'Scriptable Widget Studio',
      titleTemplate: '%s · Scriptable Widget Studio',
      meta: [
        {
          name: 'description',
          content: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.'
        },
        {
          name: 'robots',
          content: 'index, follow'
        },
        {
          name: 'application-name',
          content: 'Scriptable Widget Studio'
        },
        {
          name: 'apple-mobile-web-app-title',
          content: 'Scriptable Widget Studio'
        },
        {
          name: 'format-detection',
          content: 'telephone=no'
        },
        {
          name: 'theme-color',
          content: '#0f172a',
          media: '(prefers-color-scheme: dark)'
        },
        {
          name: 'theme-color',
          content: '#f8fafc',
          media: '(prefers-color-scheme: light)'
        },
        {
          property: 'og:type',
          content: 'website'
        },
        {
          property: 'og:site_name',
          content: 'Scriptable Widget Studio'
        },
        {
          property: 'og:title',
          content: 'Scriptable Widget Studio'
        },
        {
          property: 'og:description',
          content: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.'
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image'
        },
        {
          name: 'twitter:title',
          content: 'Scriptable Widget Studio'
        },
        {
          name: 'twitter:description',
          content: 'Build Scriptable widgets visually, inspect live data, and export readable JavaScript.'
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
