# YSU 文档站

把 `docs/public/` 下那批 markdown 渲染成一个站点，用 Nuxt 4 建，产出静态 HTML。

这个目录得待在仓库里——正文是从 `../docs/public` 读的，单独把它拷走是构建不出来的。

## 正文从哪来

**站内没有自己的正文。** `content.config.ts` 把内容源指向 `../docs/public`，构建时直接读那批 markdown。所以改文档改的是 `docs/public/` 下的文件，这个目录里不会多出一份副本，也就不会出现两份正文对不上的情况。

站点自己只管三件事：目录顺序、版式、构建。

## 目录顺序

`app/data/navigation.ts` 里写死了侧边栏的六个分组和每篇的显示名。顺序不按文件名字母排——那批文档的先后是有讲究的，从「是什么」到「怎么建」再到「内部怎么走」，字母序会把它打乱。

新增一篇文档要做两件事：写进 `docs/public/<分组>/`，在 `navigation.ts` 的对应分组里加一行。漏了第二件的话，那篇文档不会被预渲染，也进不了侧边栏。

## 命令

```bash
npm install
npm run dev        # 本地开发，默认 http://localhost:3000
npm run generate   # 产出静态 HTML 到 .output/public
npm run preview    # 本地起一个服务看静态产物
```

`npm run generate` 之后 `.output/public/` 就是可以直接丢到任意静态服务器上的东西，每个路由一个目录、里面一个 `index.html`。

这个产物里**没有服务端程序**（`.output/server` 不存在），所以它是一个纯静态站点，不需要 Node 运行时。相应地，`nuxt preview` 用不了——它要服务端产物。`npm run preview` 走的是 `serve`，直接伺服那个目录。

要部署到子路径（比如 `https://example.com/ysu/`）时，在 `nuxt.config.ts` 里加 `app: { baseURL: '/ysu/' }`。

## 静态生成的范围

`nuxt.config.ts` 里的 `nitro.prerender.routes` 由 `navigation.ts` 生成，逐条列出而不是靠爬链接。这样漏了一条路由会在构建时直接暴露出来，不会因为某个页面没被链到而悄悄少生成一个页面。

`failOnError` 打开着：任何一条路由预渲染失败都让整次构建失败。

## 404 页面

这里有一个绕路，改之前先读一遍。

**Nuxt 生成的 `404.html` 是个空壳**，里面只有 `<div id="__nuxt"></div>`，要等浏览器里 JS 跑起来才渲染。这是有意的设计：动态路由的存在让构建期无法断定某个 URL 真的是错的，所以它按 fallback 处理而不是按 404 页面处理。`error.vue` 不会被服务端渲染进这个文件。

对一个纯静态站，这个取舍不能接受——不跑 JS 就是白页，爬虫看到的也是空的。

绕法是：

1. `app/pages/404.vue` 是一个**真实路由**，渲染 `NotFound` 组件，内容完整。
2. 它被显式加进 `nitro.prerender.routes`（站点里没有任何地方链接它）。
3. 构建收尾时 `scripts/make-404.mjs` 把 `404/index.html` 复制成 `404.html`，覆盖掉那个空壳。

这一步必须在 `nuxt generate` **之后**跑——空壳是 Nitro 在收尾阶段写的，跑在前面会被它盖掉。所以 `npm run generate` 是两条命令串起来的。

`scripts/make-404.mjs` 会检查源文件存在、且内容里确实有那段文案；不满足就报错退出。构建显示成功、产物里却留着一个空壳 404，是最难发现的那种问题。

`app/error.vue` 是另一条路：应用内导航到不存在的地址、或者页面在浏览器里渲染时抛错，走的是它。两个文件共用 `NotFound` 组件，界面只写一遍。

## 发布

产物是纯静态的，丢到任意静态服务器上即可。

```bash
npm run generate
# 把 .output/public/ 整个传上去
```

要点：

- **每个路由是一个目录加一个 `index.html`**，服务器要支持目录索引（`/ysu/pipeline` → `/ysu/pipeline/index.html`）。Nginx 的 `index index.html;`、Caddy 的默认行为、各家静态托管平台都满足。
- **资源引用是绝对路径**（`/_nuxt/...`），所以只能部署在域名根下。要放在子路径（比如 `https://example.com/ysu/`），得先在 `nuxt.config.ts` 里设 `app: { baseURL: '/ysu/' }` 再重新构建。
- **让服务器把 404 交给 `404.html`**。Nginx 是 `error_page 404 /404.html;`，Apache 是 `ErrorDocument 404 /404.html`，Netlify / Cloudflare Pages / GitHub Pages 会自己认这个文件名。
- 不需要 Node 运行时，不需要任何服务端程序。

各平台的构建设置统一是：构建命令 `npm run generate`，产物目录 `.output/public`。

## 版本号

页脚显示的内核版本号在构建期从仓库根的 `version.toml` 读，不在这里另写一份。读不到就让构建失败——在页脚上显示一个假版本号比构建失败糟糕得多。

## 结构

```
app/
  assets/css/main.css      全站样式，配色变量、首屏、正文排版
  components/              页头、页脚、侧边栏、本页目录、上下篇
  data/navigation.ts       目录清单，同时供预渲染路由使用
  layouts/default.vue      页头 + 正文 + 页脚
  pages/index.vue          首屏，六个分组的入口
  pages/[...slug].vue      文档页
content.config.ts          内容源指向 ../docs/public
nuxt.config.ts             模块、预渲染、代码高亮主题、版本号
```
