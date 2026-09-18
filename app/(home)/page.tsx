import Link from 'next/link'
import type { Folder, Item } from 'fumadocs-core/page-tree'
import { source } from '@/lib/source'

/** 把一个分组里的文档页挑出来，顺序就是 meta.json 里写的那个顺序。 */
function pagesOf(folder: Folder): Item[] {
  return folder.children.filter((node): node is Item => node.type === 'page')
}

/**
 * 首屏。它不渲染任何一篇文档，只把四个分组摆出来当入口。
 *
 * 分组名、说明、页数、条目全部读页面树——也就是 content/docs 下那几份
 * meta.json，不在这里另写一份清单。加一篇文档、调一次顺序，首屏跟着变。
 */
export default function HomePage() {
  const tree = source.getPageTree()
  const sections = tree.children.filter((node): node is Folder => node.type === 'folder')
  const total = sections.reduce((sum, section) => sum + pagesOf(section).length, 0)

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1440px] px-6 pt-16 pb-2 max-sm:px-4 max-sm:pt-12">
        <h1 className="m-0 text-[40px] font-bold leading-tight tracking-[-0.01em] max-sm:text-[30px]">
          YSU 渲染内核
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16.5px] text-fd-muted-foreground">
          YSU 负责把一段 HTML 变成一块像素。它自己做词法、树构建、CSS 选择器匹配、层叠、
          布局、绘制与光栅化，不调用系统自带的网页控件。
        </p>
        <p className="mt-4 max-w-[64ch] text-sm text-fd-muted-foreground">
          这些文档按同一条顺序排：先讲清两个组件各自管什么，再讲怎么把它编出来跑起来，
          然后沿内核那条单向管线从字节走到像素。要看每条特性的落地情况，直接翻
          <Link href="/ysu/support-status" className="mx-1">
            支持范围
          </Link>
          与
          <Link href="/ysu/known-limitations" className="mx-1">
            已知限制
          </Link>
          。
        </p>
      </section>

      <section className="mx-auto grid max-w-[1440px] grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 px-6 pt-10 pb-6 max-sm:px-4 max-sm:pt-8">
        {sections.map((section) => {
          const pages = pagesOf(section)
          return (
            <Link
              key={String(section.$id ?? section.name)}
              href={section.index?.url ?? pages[0]?.url ?? '/'}
              className="flex flex-col gap-2 rounded-xl border border-fd-border p-5 no-underline transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 text-[17px] font-semibold text-fd-foreground">
                  {section.name}
                </h2>
                <span className="font-mono text-xs text-fd-muted-foreground">
                  {pages.length} 篇
                </span>
              </div>
              <p className="m-0 text-sm text-fd-muted-foreground">{section.description}</p>
              <ul className="m-0 mt-1 list-none p-0 text-[13px] leading-[1.9] text-fd-muted-foreground">
                {pages.slice(0, 4).map((item) => (
                  <li key={item.url}>{item.name}</li>
                ))}
                {pages.length > 4 ? <li>……</li> : null}
              </ul>
            </Link>
          )
        })}
      </section>

      <section className="mx-auto max-w-[1440px] px-6 pb-16 max-sm:px-4">
        <p className="max-w-[64ch] text-sm text-fd-muted-foreground">
          全部 {total} 篇，按阅读顺序排在同一份目录里。
        </p>
      </section>
    </main>
  )
}
