import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { docRoutes } from './app/data/navigation'

// 页脚显示的内核版本号，从站内的 version.toml 读。
//
// 这个文件在本仓库里，不指向外面——站点是独立仓库，构建时只该读自己带的
// 东西，否则平台只克隆这一个仓库时会找不到文件。
//
// 格式就一个 [version] 段加几个键，所以不引 TOML 解析库。
// 读不出来就报错——构建期读不到，总比在页脚上显示一个假版本号强。
function readKernelVersion(): string {
  const path = fileURLToPath(new URL('./version.toml', import.meta.url))
  const text = readFileSync(path, 'utf8')

  let inVersionSection = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }
    if (line.startsWith('[')) {
      inVersionSection = line === '[version]'
      continue
    }
    if (!inVersionSection) {
      continue
    }
    const [key, value] = line.split('=')
    if (key?.trim() === 'kernel_version') {
      return value.trim().replace(/^["']|["']$/g, '')
    }
  }

  throw new Error(`version.toml 里没有读到 kernel_version：${path}`)
}

// 站点配置。文档正文不在这个目录里，见 content.config.ts。
export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',

  modules: ['@nuxt/content'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      kernelVersion: readKernelVersion(),
    },
  },

  // 文档站不需要在浏览器里改状态，全部静态生成即可。
  ssr: true,

  devtools: { enabled: false },

  content: {
    build: {
      markdown: {
        // 目录里收 h2 与 h3 两层。再深就太长，侧边栏那列放不下。
        toc: { depth: 3, searchDepth: 3 },
        highlight: {
          // 两套主题一起交给 shiki，它会把各自的结果写成 CSS 变量，
          // 由 main.css 里的媒体查询决定用哪一套——不靠 JS 切主题。
          theme: {
            default: 'github-light',
            dark: 'github-dark',
          },
          // 这份清单会**覆盖**模块自带的默认列表，不是往上加。
          // 所以默认那几个也要写回来，否则 js/json 这类代码块会失去高亮。
          //
          // 前九个是仓库文档里实际用到的（按出现次数排），后面几个是补的常见语言。
          langs: [
            'rust',
            'bash',
            'html',
            'cpp',
            'c',
            'toml',
            'css',
            'wgsl',
            'cmake',
            'json',
            'yaml',
            'javascript',
            'typescript',
            'markdown',
            'diff',
          ],
        },
      },
    },
  },

  nitro: {
    prerender: {
      // 逐条列出而不是靠爬链接：这样少一条路由会当场发现，
      // 不会因为某个页面没被链到而悄悄漏掉。
      //
      // '/404' 是那个「没有这一页」的页面本身。它不在侧边栏里，没有任何
      // 地方链接它，所以必须显式列出来才会被生成。
      //
      // 生成出来的 404.html 不在这里——Nuxt 写的那份是空壳，由构建后的
      // scripts/make-404.mjs 用这个页面覆盖掉，原因见那个文件。
      routes: [...docRoutes(), '/404'],
      crawlLinks: true,
      failOnError: true,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'YSU 渲染内核文档',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'YSU 渲染内核的文档：HTML 与 CSS 解析、DOM、样式、布局、绘制、渲染与网络各层的实现说明，以及 C ABI 参考。',
        },
      ],
    },
  },
})
