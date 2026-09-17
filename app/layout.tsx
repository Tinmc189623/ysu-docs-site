import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { SiteFooter } from '@/components/site-footer'
import { appName, resolveSiteUrl } from '@/lib/shared'
import './global.css'

// 站点对外的绝对地址。自己配 SITE_URL，在 Vercel 上则用它注入的域名，
// 两者都没有就退回 Next 的默认行为（会指到 localhost 并给一条警告）。
const siteUrl = resolveSiteUrl()

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description:
    'YSU 渲染内核的文档：HTML 与 CSS 解析、DOM、样式、布局、绘制、渲染与网络各层的实现说明，以及 C ABI 参考。',
}

/**
 * 全站外壳。
 *
 * 页脚放在这一层而不是各个版式里，是因为首屏与文档页用的是两套完全不同的
 * 版式（HomeLayout 与 DocsLayout），页脚两边都要有，放共用祖先上只写一遍。
 *
 * RootProvider 只提供上下文（主题、搜索、i18n），不套 DOM 包裹，
 * 所以 body 直接就是那个 flex 列，页脚用 mt-auto 顶到短页面的底部。
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          {children}
          <SiteFooter />
        </RootProvider>
      </body>
    </html>
  )
}
