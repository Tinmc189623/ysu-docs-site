import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'

/**
 * 正文渲染时用的组件表。
 *
 * 默认那套来自 Fumadocs（代码块外壳、表格、标题锚点等），调用方按页覆盖。
 * 文档页会传一个 `a` 进来，用来把正文里相对的 `.md` 链接解析成站内路由。
 */
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
