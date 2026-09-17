import { docsLlms } from '@/lib/source'

// 给模型看的文档索引：一趟列出所有页面和各自地址。
// 内容在构建期就定死了，不需要按请求重算。
export const revalidate = false

export async function GET() {
  return new Response(await docsLlms.index())
}
