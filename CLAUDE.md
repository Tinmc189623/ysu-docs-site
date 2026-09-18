# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 这个站是什么

YSU 渲染内核的文档站。正文是仓库里的 `content/docs/`，33 篇 markdown，分四组。站点自己只管三件事：目录顺序、版式、构建。

技术栈是 Next.js 16 App Router + Fumadocs 16，服务端渲染。这版 Next 和 Fumadocs 的 API 跟你训练数据里的对不上，改代码前先翻 `node_modules/next/dist/docs/`，Fumadocs 那边看 `node_modules/fumadocs-ui/` 里的类型声明。`package.json` 里 `fumadocs-ui` 是 `npm:@fumadocs/base-ui@16.15.11` 的别名，这属于正常情况。

这个站原先跑在 Nuxt 4 + `@nuxt/content` 上，是纯静态导出。迁过来之后**不再是静态站**，得有个 Node 进程伺服。`README.md` 记了迁移时踩过的那几个坑，动部署相关的东西前值得读一遍。

## 命令

```bash
npm install
npm run dev          # 本地开发，http://localhost:3000
npm run build
npm start            # 跑构建产物，同样 3000
npm run types:check  # next typegen && tsc --noEmit
```

没有配置测试框架，也没有 lint 脚本。改完东西能跑的检查就是 `npm run types:check` 和 `npm run build`。

有一点容易看错：`content/docs/contributing/testing.md` 里那些 `cargo test` 讲的是 YSU 那个 Rust 项目怎么测，跟这个仓库没关系，别照着跑。

## 内容怎么进到页面里

`lib/source.ts` 一处定完。`defineDocs`（`fumadocs-mdx/macro` 提供的宏）把内容源指向 `content/docs`，标题摘要的 schema 用 Fumadocs 自带的 `pageSchema`，`postprocess.includeProcessedMarkdown` 打开是为了 llms 那几条路由要拿编译后的正文。编译动作挂在 `next.config.mjs` 的 `createMDX()` 上，中间产物落在 `.source/`，已 gitignore。

这里没有 `source.config.ts`——文档定义直接写在 `lib/source.ts` 里。

## 导航只有一份来源

侧边栏、页头分组链接、首屏卡片、404 页的推荐位，全部读 `source.getPageTree()`。顺序、分组显示名、分组说明写在 `content/docs/` 下每层的 `meta.json` 里。

**新增一篇文档要做两件事**：把 markdown 放进对应分组目录，在同一个目录的 `meta.json` 的 `pages` 数组里加一行。漏了第二件，那一篇不会出现在侧边栏，构建也不会报错——静默丢失，所以加完记得核对。`pages` 要列全，顺序是有讲究的（从「是什么」到「怎么建」再到「内部怎么走」），不按字母排。

`defaultOpen: true` 和 `app/(docs)/layout.tsx` 里的 `tabs={false}` 是同一个取舍的两面：四十来篇摊开比让人一层层点开更快找到东西。别顺手改成默认收起。

## 几个不显眼但别改的地方

**`docsRoute = ''`（`lib/shared.ts`）**：文档挂在站点根，`content/docs/ysu/pipeline.md` 就是 `/ysu/pipeline`。这是为了保住 Nuxt 那版已经发出去的链接。由此推出一条约束：`content/docs` 下不能出现 `index.md`——站点根留给首屏 `app/(home)/page.tsx`，真冲突了构建会报错。

**`export const dynamicParams = false`（`app/(docs)/[...slug]/page.tsx`）**：少了这一行，`/ysu/does-not-exist` 这类地址会走按需动态渲染，流式输出会先把页面外壳冲出去，等 `notFound()` 抛出来已经来不及改成 HTML，最后送到浏览器的是一片白加一段 RSC 负载，爬虫看到的也是空。整个文件顶部那段注释就是在讲这件事。

**`outputFileTracingIncludes`（`next.config.mjs`）**：页脚的内核版本号从仓库根的 `version.toml` 读，Vercel 上跑的是打包后的函数，这行是在声明「这个文件必须进部署产物」。删了就是一个全站 500，而且本地永远复现不出来。

**`components/site-footer.tsx` 里的版权行**：固定文案，品牌名必须完整保留，一个字都不能改。

## version.toml

内核版本号的唯一来源，`lib/version.ts` 在构建期读它，读不到就抛错让构建失败——页脚显示一个假版本号比构建失败糟糕。`lib/version.ts` 走的是 `process.cwd()` 而不是 `import.meta.url`，因为服务端代码是打过包的，后者会指到 `.next` 里去。解析用手写的逐行扫，没引 TOML 库，格式就一个 `[version]` 段，够用。

## 写正文的约定

标题放进 frontmatter 的 `title`，**正文里不要再写 H1**，页面大标题由 Fumadocs 渲染。摘要同理放 `description`。

指向别的文档的链接必须写成 `./` 或 `../` 开头，比如 `[已知限制](./known-limitations.md)`、`[层叠与继承](../ysu/cascade-and-inheritance.md)`。Fumadocs 只解析这两种前缀，裸写文件名它会原样放过去，在浏览器里就成了相对当前地址的错链。解析工作由 `app/(docs)/[...slug]/page.tsx` 里挂的 `createRelativeLink` 做。

## 给模型读的入口

`/llms.txt` 列全部文档和地址，`/llms-full.txt` 把 33 篇正文拼成一个纯文本，`/llms.mdx/docs/<路径>/content.md` 是单篇的 markdown 原文。这三条都从 `lib/source.ts` 里那个 `docsLlms` 出，路径拼接的细节在 `lib/shared.ts` 的 `getPageMarkdownUrl`。

搜索不是这一套：索引在服务端建，查询走 `/api/search`，所以搜索依赖 Node 进程活着。

## 404 和 500 是两条路

`app/not-found.tsx` 管 404，服务端渲染出完整 HTML，未知路径和 `source.getPage()` 查不到都走它。`app/error.tsx` 管页面渲染抛错，是 500，必须是客户端组件——也正因为如此，它里面不能读 `version.toml` 这类只有服务端才有的东西。

## 部署

Vercel 零配置，构建命令 `npm run build`，输出目录保持默认，**别填 `.next`**。自定义域名配 `SITE_URL`；不配的话 `lib/shared.ts` 的 `resolveSiteUrl()` 会依次读 Vercel 注入的 `VERCEL_PROJECT_PRODUCTION_URL` 和 `VERCEL_URL`。子路径部署（`https://example.com/ysu/`）在 `next.config.mjs` 里加 `basePath: '/ysu'` 后重新构建即可，`meta.json` 和 `docsRoute` 都不用动。

## next dev 会往仓库里写文件

`next dev` 启动时会检查 `AGENTS.md` 和 `CLAUDE.md` 里有没有它那段规则 block，没有就补上（逻辑在 `node_modules/next/dist/server/lib/generate-agent-files.js`）。当前是 `AGENTS.md` 承载那段 block，所以它只维护 `AGENTS.md`；`CLAUDE.md` 见 `AGENTS.md` 已有 block 就跳过，不会被覆盖。把 `AGENTS.md` 删掉的话，那段 block 下次启动会重新长出来，跟着提交比反复删干净。

这个文件顶部那行 `@AGENTS.md` 是刻意留的，靠它把那段规则引进来，别删。不想要这套就在 `next.config.mjs` 里设 `agentRules: false`。
