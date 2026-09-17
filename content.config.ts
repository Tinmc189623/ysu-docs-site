import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig } from '@nuxt/content'

// 正文在站内，就是这个仓库里的 content/ 目录。
//
// 之前这行指向仓库外面的 ../docs/public，那是错的：站点有自己的仓库，
// 构建时不该往仓库外面看一眼。一旦那样写，部署平台只克隆这一个仓库时
// 就找不到文件，而且要在两个仓库之间维持一份「必须一起改」的约束。
//
// 路径从本文件算起，说明它是仓库内的相对位置，不是相对当前工作目录。
const contentDir = fileURLToPath(new URL('./content', import.meta.url))

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: {
        cwd: contentDir,
        include: '**/*.md',
      },
    }),
  },
})
