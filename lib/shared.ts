import { createGetUrl } from 'fumadocs-core/source'

/** 站名，出现在页签标题与 OG 图上。 */
export const appName = 'YSU 渲染内核文档'

/**
 * 站点对外的绝对地址，给 metadataBase 用。
 *
 * 不设的话 Next 会退回 localhost 并给一条警告，页面本身照样能跑，
 * 只是分享出去时绝对地址是错的。取的顺序：
 *
 *   1. `SITE_URL`——自己配的，用了自定义域名就该配这个；
 *   2. `VERCEL_PROJECT_PRODUCTION_URL`——Vercel 自动给的正式域名；
 *   3. `VERCEL_URL`——当前这次部署的域名，预览环境靠它拿到对的地址。
 *
 * 后两个是 Vercel 自己注入的，不带协议，所以要补上 https://。
 */
export function resolveSiteUrl(): string | undefined {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) {
    // 带上协议才能用。写漏了就在这里当场报错，别等到线上发现分享出去的
    // 地址是坏的——那时候已经发出去了。
    try {
      new URL(explicit)
    } catch {
      throw new Error(
        `SITE_URL 不是一条合法地址：${explicit}。要带协议，比如 https://docs.example.com`,
      )
    }
    return explicit.replace(/\/+$/, '')
  }

  // 这两个是 Vercel 注入的域名，不带协议。末尾的斜杠它自己不会给。
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercelHost) {
    return `https://${vercelHost}`
  }

  return undefined
}

/**
 * 文档挂在哪一段路径下。
 *
 * 空串表示挂在站点根：正文 `content/docs/ysu/pipeline.md` 对应 `/ysu/pipeline`。
 * 原来的 Nuxt 站就是这么排的，迁过来保持原样，免得已经发出去的链接失效。
 * 空串能成立是因为 Fumadocs 拼 URL 时会滤掉空路径段，不会拼出双斜杠。
 */
export const docsRoute = ''

/** 正文的原始 markdown 从哪取。给 `llms.mdx` 那条路由用。 */
const docsContentRoute = '/llms.mdx/docs'

// 返回一对东西：给路由用的路径段，和可以直接塞进 href 的地址。
// 那条路由的最后一段是固定名字 `content.md`，前面那段才是文档自己的 slug——
// 所以 `segments` 比文档多出一段，取页面时得把最后那段切掉，
// 见 app/llms.mdx/docs/[[...slug]]/route.ts 里的写法。
const contentUrl = createGetUrl(docsContentRoute)

/** 这一篇的 markdown 原文地址。 */
export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md']
  return { segments, url: contentUrl(segments, page.locale) }
}
