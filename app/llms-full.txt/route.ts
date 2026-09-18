import { docsLlms } from '@/lib/source'

// 全部文档的正文，拼成一个纯文本文件。
// 三十三篇下来体积不小，但这是给模型一次性读完整套文档用的，不给人读。
export const revalidate = false

export async function GET() {
  return new Response(await docsLlms.full())
}
