// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-14',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  app: {
    head: {
      title: 'JobFinder — vagas que ninguém achou',
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Busca vagas no LinkedIn, Gupy, sites de carreira das empresas e agregadores remotos, com match pelo seu currículo.' }
      ],
      // Aplica o tema antes da primeira pintura (evita piscar claro→escuro)
      script: [
        { innerHTML: "try{var t=localStorage.getItem('jf_theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}" }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' }
      ]
    }
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.js'
  },
  nitro: {
    // Arquivos do agente local embutidos no servidor (na Vercel não há acesso à pasta do projeto)
    serverAssets: [
      { baseName: 'agente', dir: fileURLToPath(new URL('./agente-local', import.meta.url)), pattern: '*.{py,txt,bat,sh,md}' }
    ],
    // Vercel: as buscas levam ~40s e a rotina do cron alguns minutos (o plano gratuito permite até 300s)
    vercel: {
      functions: { maxDuration: 300 },
      // Rotina diária (limite do plano gratuito); o GitHub Actions complementa a cada 6h
      config: { crons: [{ path: '/api/cron/indexar', schedule: '0 9 * * *' }] }
    }
  }
});
