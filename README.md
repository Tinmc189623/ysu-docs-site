# YSU 文档站

把 `content/docs/` 下那批 markdown 渲染成一个站点，用 Next.js 建，服务端渲染。

正文就在这个仓库里，构建时只读自己带的东西，不往仓库外面看——所以整个目录拷到哪都能构建出来。

站点自己只管三件事：目录顺序、版式、构建。

## 从 Nuxt 迁过来

这个站原先用 Nuxt 4 加 `@nuxt/content` 建，是纯静态导出。现在换成 Next.js 加 Fumadocs，服务端渲染。几处关键差异，改之前值得先知道：

**部署形态变了。** 以前产物是一堆 HTML，丢到任意静态服务器上就行，不需要 Node。现在 `next build` 出的是 `.next/` 加一个 Node 服务，得 `next start` 跑着。这一条影响最大，下面「发布」那节重写过。

**目录顺序换地方了。** 以前写死在 `app/data/navigation.ts`，现在拆成 `content/docs/` 下每个目录一份 `meta.json`。顺带那个文件删了——侧边栏、页头、首屏卡片现在都读同一棵页面树，不用再维护一份清单。

**正文补了 frontmatter。** 以前标题和摘要由 Nuxt Content 从首个 H1 和首段自动抽，正文里那个 H1 是渲染出来的。Fumadocs 把标题当元数据，正文里再留一个 H1 就重复了，所以迁移时把标题搬进了 frontmatter、从正文里删掉，顺带把首段抽成了 `description`。当时那批每一篇都过了一遍。

**URL 没变。** 文档仍然挂在站点根下，`/ysu/pipeline` 还是 `/ysu/pipeline`。这一条是特意保住的，`lib/shared.ts` 里把 `docsRoute` 设成空串就是这个用意。

**404 那段绕路不用了。** 详见下面那一节。

## 正文从哪来

正文在站内，就是仓库根的 `content/docs/`。`lib/source.ts` 里的 `defineDocs` 把内容源指向它，构建时直接读那批 markdown。改文档改的就是这里的文件。

站点有自己的仓库，构建时不该往仓库外面看一眼。早先这里指过仓库外面的 `../docs/public`，那是错的：部署平台只克隆这一个仓库时就找不到文件，还得在两个仓库之间维持一份「必须一起改」的约束。

## 目录顺序

顺序、分组显示名、分组说明都写在 `meta.json` 里。根上那份 `content/docs/meta.json` 排四个分组的先后，各分组目录里那份排组内每一篇的先后，同时提供侧边栏上的分组名和首屏卡片上那句说明。

顺序不按文件名字母排——那批文档的先后是有讲究的，从「是什么」到「怎么建」再到「内部怎么走」，字母序会把它打乱。所以 `pages` 数组要把每一篇都列全。

新增一篇文档要做两件事：写进 `content/docs/<分组>/`，在同一个目录的 `meta.json` 的 `pages` 里加一行。漏了第二件的话那一篇不会出现在侧边栏里。

各分组 meta.json 里的 `defaultOpen: true` 是让侧边栏默认整棵摊开。四十来篇不算多，摊开比让人一次次点开更快找到东西；想收起来还是能收。

## 写正文时注意两件事

**标题放 frontmatter，正文里不要再写 H1。** 页面上的大标题由 Fumadocs 从 `title` 渲染。

**指向别的文档的链接要写成 `./` 或 `../` 开头。** 比如 `[已知限制](./known-limitations.md)`、`[层叠与继承](../ysu/cascade-and-inheritance.md)`。Fumadocs 只解析这两种前缀，裸写的 `known-limitations.md` 它会原样放过去，在浏览器里就成了相对当前地址的错链。`(docs)/[...slug]/page.tsx` 里挂的 `createRelativeLink` 负责把它解析成站内路由。

## 命令

```bash
npm install
npm run dev          # 本地开发，默认 http://localhost:3000
npm run build        # 构建
npm start            # 跑构建产物，同样是 3000
npm run types:check  # 只做类型检查
```

开发模式起来之后 Next 会往仓库里写 `AGENTS.md` 和 `CLAUDE.md` 两个文件——前者是给 AI 代理看的提示，后者只有一行 `@AGENTS.md`。这是 Next 16 的默认行为，删掉下次启动还会重建。不想要就在 `next.config.mjs` 里设 `agentRules: false`。

## 发布

```bash
npm run build
npm start
```

需要 Node 运行时，默认监听 3000 端口。**不再是纯静态站点**——`next build` 之后没有可以单独丢到静态服务器上的 HTML 目录，`.next/` 得配一个 Node 进程来伺服。

子路径部署（比如 `https://example.com/ysu/`）要在 `next.config.mjs` 里加 `basePath: '/ysu'` 再重新构建。此时 `content/docs/meta.json` 里的分组名和 `lib/shared.ts` 里那个空串都不用动，Fumadocs 拼路径时会自己带上。

搜索是服务端跑的：索引在服务端建，查询走 `/api/search`。所以搜索依赖那个 Node 进程活着，压成纯静态就没得用了。

### Vercel

零配置。Vercel 自己认 Next.js，构建设置一个字都不用改：构建命令 `npm run build`，输出目录保持默认——**别填 `.next`**，那是框架产物目录，填了反而出错。

Node 版本它在构建时自己挑，`package.json` 里的 `engines.node` 写的 `>=20.9.0` 就是 Next 16 的要求。

**域名不用手动配。** 没给 `SITE_URL` 时，`lib/shared.ts` 里的 `resolveSiteUrl()` 会依次读 Vercel 注入的两个变量——`VERCEL_PROJECT_PRODUCTION_URL`（这个项目的正式域名）和 `VERCEL_URL`（当前这一次部署的域名）——所以连预览部署都能拿到正确的绝对地址。要用自己的域名就配 `SITE_URL`，它优先级最高。三条都实测过。

**有一处是 Vercel 特有的坑**，`next.config.mjs` 里那行 `outputFileTracingIncludes` 就是为它写的：页脚要读仓库根的 `version.toml`，而 Vercel 上跑的是打包后的函数，只有被打进产物的文件才在，读不到就是一个**全站 500**。本地永远碰不到这个问题，文件就在手边，所以这个坑不专门测一次是发现不了的。

搜索在 Vercel 上是一条 Serverless Function，索引在冷启动时建。实测这个体量（四十多篇），第一次请求（含建索引）185 毫秒，之后每次十几毫秒，不用管。

### 自己的服务器

按 Node 应用配：构建命令 `npm run build`，启动命令 `npm start`。跑之前确认 `version.toml` 跟构建产物在同一台机器上——跟上面 Vercel 那条是同一个道理。

## 404

现在不需要绕路了。

以前有一整套绕法：Nuxt 生成的 `404.html` 只是个空壳，要等浏览器里 JS 跑起来才渲染，所以另做了一个真实路由 `/404`，构建收尾再用 `scripts/make-404.mjs` 把它复制过去覆盖。纯静态站不能承受「不跑 JS 就是白页」，那段绕路就是为了这个。

Next 的 App Router 本来就把 `app/not-found.tsx` 渲染成完整的 HTML，脚本和那份说明一起删了。

**但有一个坑，改动时别踩。** `app/(docs)/[...slug]/page.tsx` 里的 `export const dynamicParams = false` 不是可有可无的一行。不写的话，`/ysu/does-not-exist` 这类落不进 `generateStaticParams` 的地址会走按需动态渲染，而流式输出会先把页面外壳冲出去，等 `notFound()` 抛出来已经来不及改成 HTML——最后送到浏览器的是一个空壳加一段 RSC 负载，不跑 JS 就是一片白，爬虫看到的也是空的。那正是上面这段绕路想解决的问题，会在新栈上原样复现。

关掉动态参数之后，未知路径交给 `app/not-found.tsx`，那一页是老老实实服务端渲染出来的完整 HTML，状态码是 404。

`app/error.tsx` 是另一条路：页面在渲染时抛错走它，是 500 不是 404。两个文件分开写。

## 版本号

页脚显示的内核版本号在构建期从仓库根的 `version.toml` 读（见 `lib/version.ts`），不在这里另写一份。读不到就让构建失败——在页脚上显示一个假版本号比构建失败糟糕得多。

这个文件必须跟着部署产物一起走，见「发布」那节里 Vercel 那一段。

## 搜索与 llms.txt

除了页面上的搜索框，还开着一个给模型读的入口：

- `/llms.txt` 列出所有文档和各自地址
- `/llms-full.txt` 把三十三篇正文拼成一个纯文本文件
- `/llms.mdx/docs/<路径>/content.md` 单篇的 markdown 原文

暂时没有每篇的分享图（OG image）。Fumadocs 那套要传给 `next/og` 一个中文字体，在线拉字体的做法在构建时依赖网络、失败还看不出来，所以先没上。要加的话，正确做法是往仓库里放一个中文字体文件，通过 `generateOGImage` 的 `fonts` 参数传进去。

## 结构

```
app/
  layout.tsx                    全站外壳：html、RootProvider、页脚
  global.css                    Tailwind 入口、Fumadocs 主题、中文字体栈
  (home)/page.tsx               首屏，四个分组的入口
  (docs)/[...slug]/page.tsx     文档页
  not-found.tsx                 404
  error.tsx                     渲染出错时的兜底（客户端组件）
  api/search/route.ts           搜索接口
  llms.txt/route.ts             文档索引
  llms-full.txt/route.ts        全文
  llms.mdx/docs/[[...slug]]/    单篇 markdown 原文
components/
  mdx.tsx                       正文渲染用的组件表
  site-footer.tsx               页脚：内核版本 + 版权
lib/
  source.ts                     内容源、页面树、llms 入口
  shared.ts                     站名、文档挂载路径、取地址的工具
  layout.shared.tsx             页头与导航配置，两套版式共用
  version.ts                    从 version.toml 读内核版本号
content/docs/                   正文，33 篇 markdown，分四个目录，每目录一份 meta.json
next.config.mjs                 挂 MDX 插件，声明 version.toml 要进部署产物
postcss.config.mjs              Tailwind 4 走 PostCSS
version.toml                    页脚显示的内核版本号
```
