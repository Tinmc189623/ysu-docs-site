// 侧边栏的目录。
//
// 这份清单一处两用：页面拿它渲染导航，构建时拿它列出要预渲染的路由。
// 顺序是写死的，不按文件名字母序——文档本身的顺序是有讲究的，
// 从「是什么」到「怎么建」再到「内部怎么走」，字母序会把它打乱。

export interface NavItem {
  /** 站内路径，与 content/ 下的文件路径对应。 */
  path: string
  /** 侧边栏与分页器上显示的名字。 */
  title: string
}

export interface NavSection {
  /** 分组标识，也是路径的第一段。 */
  slug: string
  /** 分组标题。 */
  title: string
  /** 分组说明，只出现在首屏的分区卡片上。 */
  blurb: string
  items: NavItem[]
}

export const sections: NavSection[] = [
  {
    slug: 'introduction',
    title: '总览',
    blurb: '两个组件各自负责什么、代码怎么分、几条反复出现的取舍。',
    items: [
      { path: '/introduction/what-is-ysu', title: 'YSU 是什么' },
      { path: '/introduction/what-is-vexo', title: 'Vexo 是什么' },
      { path: '/introduction/project-layout', title: '仓库结构' },
      { path: '/introduction/design-principles', title: '设计原则' },
      { path: '/introduction/glossary', title: '术语表' },
      { path: '/introduction/versioning', title: '版本号规则' },
      { path: '/introduction/release-notes-0.1.0', title: '0.1.0 发布说明' },
    ],
  },
  {
    slug: 'getting-started',
    title: '构建与使用',
    blurb: '需要什么工具链、怎么把它编出来、编完怎么跑。',
    items: [
      { path: '/getting-started/prerequisites', title: '准备环境' },
      { path: '/getting-started/build-rust', title: '构建 Rust 侧' },
      { path: '/getting-started/build-ui-linux', title: '构建外壳（Linux）' },
      { path: '/getting-started/build-ui-other-platforms', title: '其他平台的构建' },
      { path: '/getting-started/running-vexo', title: '启动 Vexo' },
      { path: '/getting-started/keyboard-shortcuts', title: '快捷键' },
      { path: '/getting-started/local-files-and-cli', title: '本地文件与命令行' },
      { path: '/getting-started/troubleshooting', title: '排错' },
    ],
  },
  {
    slug: 'ysu',
    title: 'YSU 内核',
    blurb: '从字节到像素的六个阶段，一层一层往下走。',
    items: [
      { path: '/ysu/pipeline', title: '单向管线' },
      { path: '/ysu/html-tokenizer', title: 'HTML 词法' },
      { path: '/ysu/tree-construction', title: '树构建' },
      { path: '/ysu/character-references', title: '字符引用' },
      { path: '/ysu/dom', title: 'DOM' },
      { path: '/ysu/css-tokenizer', title: 'CSS 词法' },
      { path: '/ysu/css-parser', title: 'CSS 解析' },
      { path: '/ysu/selectors', title: '选择器' },
      { path: '/ysu/cascade-and-inheritance', title: '层叠与继承' },
      { path: '/ysu/computed-style', title: '计算样式' },
      { path: '/ysu/layout-box-model', title: '盒模型与布局树' },
      { path: '/ysu/layout-block-and-inline', title: '块级与行内布局' },
      { path: '/ysu/layout-text', title: '文本排版' },
      { path: '/ysu/layout-flex', title: '弹性布局' },
      { path: '/ysu/layout-table', title: '表格布局' },
      { path: '/ysu/paint-and-display-list', title: '绘制与显示列表' },
      { path: '/ysu/renderer', title: '渲染器' },
      { path: '/ysu/networking-and-encoding', title: '网络与字符集' },
      { path: '/ysu/address-and-builtin-pages', title: '地址与内置页面' },
      { path: '/ysu/engine', title: '内核门面' },
      { path: '/ysu/support-status', title: '支持范围' },
      { path: '/ysu/known-limitations', title: '已知限制' },
    ],
  },
  {
    slug: 'capi',
    title: 'C ABI',
    blurb: '把内核嵌进自己的程序时，边界上有什么、要注意什么。',
    items: [
      { path: '/capi/overview', title: '总览' },
      { path: '/capi/function-reference', title: '函数参考' },
      { path: '/capi/memory-and-ownership', title: '内存与所有权' },
      { path: '/capi/threading', title: '线程模型' },
      { path: '/capi/abi-versioning', title: 'ABI 版本' },
      { path: '/capi/worked-example', title: '完整示例' },
    ],
  },
  {
    slug: 'jse',
    title: 'JSE',
    blurb: 'JavaScript 引擎，词法与语法分析完成，运行期刚起步。',
    items: [
      { path: '/jse/overview', title: '总览' },
      { path: '/jse/lexer-and-parser', title: '词法与语法' },
      { path: '/jse/status', title: '进展与缺口' },
    ],
  },
  {
    slug: 'contributing',
    title: '参与',
    blurb: '改代码之前要知道的几件事，以及提交之前要跑的命令。',
    items: [
      { path: '/contributing/guide', title: '参与开发' },
      { path: '/contributing/code-style', title: '代码风格' },
      { path: '/contributing/testing', title: '测试' },
    ],
  },
]

/** 按侧边栏顺序拍平的文档清单，分页器与预渲染路由都用它。 */
export const flatDocs: NavItem[] = sections.flatMap((section) => section.items)

/** 全部要静态生成的路由。 */
export function docRoutes(): string[] {
  return ['/', ...flatDocs.map((item) => item.path)]
}

/** 查出某个路径属于哪个分组。 */
export function sectionOf(path: string): NavSection | undefined {
  return sections.find((section) => section.items.some((item) => item.path === path))
}

/** 取前一篇与后一篇。到头或到尾时对应的一项为 undefined。 */
export function neighboursOf(path: string): { prev?: NavItem; next?: NavItem } {
  const index = flatDocs.findIndex((item) => item.path === path)
  if (index < 0) {
    return {}
  }
  return { prev: flatDocs[index - 1], next: flatDocs[index + 1] }
}
