import { notFound } from 'next/navigation'
import { docsLlms, source } from '@/lib/source'
import { getPageMarkdownUrl } from '@/lib/shared'

// 单篇文档的 markdown 原文。
//
// 路径末尾固定是 content.md，前面那段是文档自己的 slug——
// `/llms.mdx/docs/ysu/pipeline/content.md` 对应 `/ysu/pipeline`。
// 所以取页面时要把最后那段切掉。
export const revalidate = false

interface RouteParams {
  params: Promise<{ slug?: string[] }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params
  const page = source.getPage(slug?.slice(0, -1))
  if (!page) {
    notFound()
  }

  return new Response(await docsLlms.page(page), {
    headers: { 'Content-Type': 'text/markdown' },
  })
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageMarkdownUrl(page).segments,
  }))
}
