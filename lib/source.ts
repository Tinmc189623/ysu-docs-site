import { llms, loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'
import { docsRoute } from './shared'

// 正文在站内，就是这个仓库里的 content/docs/。
//
// 站点有自己的仓库，构建时不该往仓库外面看一眼——一旦那样写，部署平台只克隆
// 这一个仓库时就找不到文件，还得在两个仓库之间维持一份「必须一起改」的约束。
//
// dir 从项目的根算起，不写相对本文件的路径。
const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // 标题与摘要由页面自己的 frontmatter 给。两份 zod schema 来自 Fumadocs，
    // 字段就那几个：title、description、icon，够用，不另起一套。
    schema: pageSchema,
    postprocess: {
      // llms.txt 与 markdown 原文要用到编译后的正文，不打开这项就取不到。
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    // meta.json 决定侧边栏顺序、分组显示名与分组说明。
    schema: metaSchema,
  },
})

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
})

// llms.txt 那一套：给模型读的纯文本索引与正文。
export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
})
