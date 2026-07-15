export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@vercel/analytics'],
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
      title: 'Widget Studio',
      titleTemplate: '%s · Widget Studio',
      meta: [
        {
          name: 'description',
          content: 'Drag and drop Scriptable widgets, preview layouts live, and export clean JavaScript.'
        },
        {
          name: 'keywords',
          content: 'Scriptable widgets, widget builder, visual editor, drag and drop, iPhone widgets, JavaScript'
        },
        {
          name: 'robots',
          content: 'index, follow'
        },
        {
          name: 'application-name',
          content: 'Widget Studio'
        },
        {
          name: 'apple-mobile-web-app-title',
          content: 'Widget Studio'
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
          content: 'Widget Studio'
        },
        {
          property: 'og:title',
          content: 'Widget Studio - Drag and drop Scriptable widgets'
        },
        {
          property: 'og:description',
          content: 'Drag and drop Scriptable widgets, preview layouts live, and export clean JavaScript.'
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image'
        },
        {
          name: 'twitter:title',
          content: 'Widget Studio - Drag and drop Scriptable widgets'
        },
        {
          name: 'twitter:description',
          content: 'Drag and drop Scriptable widgets, preview layouts live, and export clean JavaScript.'
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
