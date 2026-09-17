import type { Metadata } from 'next'
import Link from 'next/link'
import type { Folder, Item } from 'fumadocs-core/page-tree'
import { source } from '@/lib/source'

export const metadata: Metadata = {
  title: '没有这一页',
  robots: 'noindex',
}

/**
 * 「没有这一页」。
 *
 * 两条路都走到这里：地址栏敲了一个不存在的路径，或者文档页里
 * `source.getPage()` 没查到那一篇、调了 notFound()。
 *
 * 原来那版是 Nuxt 的一个绕路——静态服务器不跑 JS，Nuxt 生成的 404.html
 * 只是个空壳，得另外生成一份真页面再覆盖过去。换成 Next 之后
 * App Router 本来就把这个文件渲染成完整的 HTML，那段绕路和配套脚本都不需要了。
 *
 * 兜底给几个入口：走错路的人多半是想找某一篇，直接给目录比给一句
 * 「页面不存在」有用。
 */
export default function NotFound() {
  // 取阅读顺序最前面的三篇，跟原来那版取的是同一批。
  // 顺序从页面树来，不用 source.getPages()——那个顺序是内部索引顺序，
  // 跟侧边栏看到的排法不是一回事。
  const firstSection = source
    .getPageTree()
    .children.find((node): node is Folder => node.type === 'folder')
  const picks: Item[] = (firstSection?.children ?? [])
    .filter((node): node is Item => node.type === 'page')
    .slice(0, 3)

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-24 pb-16 max-sm:px-4 max-sm:pt-14">
      <p className="m-0 font-mono text-[13px] tracking-[0.08em] text-fd-muted-foreground">
        404
      </p>
      <h1 className="mt-2 mb-0 text-[30px] font-bold leading-snug max-sm:text-[25px]">
        没有这一页
      </h1>
      <p className="mt-4 mb-0 text-fd-muted-foreground">
        这个地址不在文档目录里，可能写错了，也可能那篇已经改了名字。
      </p>

      <p className="mt-7 mb-0 text-[15px]">
        <Link href="/">回到文档索引</Link>
      </p>

      <div className="mt-10 rounded-xl border border-fd-border px-6 py-5">
        <p className="m-0 mb-1 text-xs text-fd-muted-foreground">或者从这里开始</p>
        <ul className="m-0 list-none p-0 text-sm leading-[2]">
          {picks.map((page) => (
            <li key={page.url}>
              <Link href={page.url}>{page.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
