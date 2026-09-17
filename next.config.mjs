import { createMDX } from 'fumadocs-mdx/next';

// 正文是 markdown，编译在 Next 的构建流程里做，所以要把 MDX 插件挂上去。
// 文档源码怎么收集由 lib/source.ts 里的 defineDocs 决定，这个包装器只管编译。
const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  // 页脚要读仓库根的 version.toml（见 lib/version.ts）。
  // 本地跑无所谓，文件就在手边；部署到 Vercel 时不一样——那边跑的是打包后的
  // 函数，只有被打进产物的文件才在，读不到就是一个全站 500。
  //
  // 实测 Next 的文件追踪能认出 join(process.cwd(), 'version.toml') 这种写法，
  // 顺手就把文件收进去了（构建后查 .next 里的 .nft.json 清单能看见）。
  // 但那是它的路径推断，不是这里的显式约定，换个版本可能就变了。
  // 这一行把话说明白：不管怎么打包，version.toml 都得跟着走。
  outputFileTracingIncludes: {
    '/**': ['./version.toml'],
  },
};

export default withMDX(config);
