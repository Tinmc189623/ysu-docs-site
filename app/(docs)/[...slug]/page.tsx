import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { getMDXComponents } from '@/components/mdx'
import { source } from '@/lib/source'

// 路径用的是必选 catch-all（不带双方括号），所以这个路由至少有一段路径。
// 根地址留给首屏（app/(home)/page.tsx）——两个路由都命中 `/` 的话 Next 会报冲突。
//
// 由此推出一件事：content/docs 下不该出现 index.md。真出现了，
// source.generateParams() 会吐出一个空 slug，构建会当场报错而不是悄悄少一页，
// 这正是想要的效果——站点根是首屏，不是一篇文档。

// 不认识的路径直接判 404，不要按需去渲染一遍。
//
// 这一行不是可有可无的：不写的话，`/ysu/does-not-exist` 这类落不进
// generateStaticParams 的地址会走按需动态渲染，而流式输出会先把页面外壳
// 冲出去，等 notFound() 抛出来已经来不及改成 HTML 了——最后送到浏览器的
// 是一个空壳加一段 RSC 负载，不跑 JS 就是一片白，爬虫看到的也是空的。
//
// 这正是原来 Nuxt 那版栽过的坑（见 README 里 404 那一节）。
// 关掉动态参数之后，未知路径交给 app/not-found.tsx，那一页是老老实实
// 服务端渲染出来的完整 HTML。
export const dynamicParams = false

interface DocPageProps {
  params: Promise<{ slug: string[] }>
}

/** 取出这一篇。取不到就交给 not-found，由它渲染「没有这一页」。 */
async function loadPage(params: DocPageProps['params']) {
  const { slug } = await params
  return source.getPage(slug)
}

export default async function Page({ params }: DocPageProps) {
  const page = await loadPage(params)
  if (!page) {
    notFound()
  }

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // 正文里写的是相对的 `.md` 链接（`./known-limitations.md`、
            // `../capi/threading.md`），靠它解析成站内路由。
            // Fumadocs 只认带 `./` 或 `../` 前缀的形式，所以正文里那批
            // 裸写的文件名在迁移时已经补齐了前缀。
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const page = await loadPage(params)
  if (!page) {
    notFound()
  }

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
