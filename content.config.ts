import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig } from '@nuxt/content'

// 文档的唯一来源是仓库里的 docs/public。站点这边不复制一份出来——
// 复制出来的那份迟早会和原文不一致，而改文档的人不会记得同步两次。
//
// 路径写成从本文件算起的绝对路径，不用 '../docs/public' 这种相对写法：
// 那种写法要经过 process.cwd()，而构建时的 cwd 未必是站点目录。
const docsDir = fileURLToPath(new URL('../docs/public', import.meta.url))

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: {
        cwd: docsDir,
        include: '**/*.md',
        // docs/public/README.md 是那份文档集自己的目录页，
        // 站点有独立的首屏，把它排除掉，免得两边说同一件事。
        exclude: ['README.md'],
      },
    }),
  },
})
