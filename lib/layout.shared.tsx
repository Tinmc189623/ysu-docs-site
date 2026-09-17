import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import type { Folder, Item } from 'fumadocs-core/page-tree'
import { source } from './source'

/** 页头左边的品牌区。两块字用不同字号错开，跟原来那版一致。 */
function Brand() {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-[17px] font-bold tracking-[0.06em]">YSU</span>
      <span className="hidden text-xs text-fd-muted-foreground sm:inline">渲染内核</span>
    </span>
  )
}

/**
 * 首屏与文档页共用的版式配置。
 *
 * 分组清单从页面树里取，不另抄一份——侧边栏、页头、首屏卡片都读同一棵树，
 * 加一个分组只需要写一个目录加一份 meta.json。
 */
export function baseOptions(): BaseLayoutProps {
  const tree = source.getPageTree()
  const sections = tree.children.filter((node): node is Folder => node.type === 'folder')

  return {
    nav: { title: <Brand /> },
    // 页头只列分组，不列具体文档——具体文档交给侧边栏，
    // 两处都列一遍会让页头在窄屏上挤成一团。
    links: sections.map((section) => {
      const first = section.children.find((child): child is Item => child.type === 'page')
      return {
        text: section.name,
        url: section.index?.url ?? first?.url ?? '/',
      }
    }),
    // 这里不给 githubUrl：手上没有这个站对应的仓库地址，编一个填上去还不如不填。
    // 真要加，那也该是填真实地址的时候顺手加。
  }
}
