import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

// 文档页的版式：页头 + 左侧目录 + 正文 + 右侧本页目录。
//
// 这是个路由组（目录名带括号），不占 URL 段。文档就挂在站点根下，
// `/ysu/pipeline` 直接对应 content/docs/ysu/pipeline.md。
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      // 关掉 tab。不关的话 Fumadocs 会把四个顶层分组折成横向 tab，
      // 侧边栏一次只展开当前那一组，其余四十来篇要点两下才看得到。
      //
      // 整棵树摊开是原来那版的取舍，理由写在 DocsSidebar 的注释里：
      // 四十来篇不算多，摊开比让人一次次点开更快找到东西。
      tabs={false}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  )
}
