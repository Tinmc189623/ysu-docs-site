// 把 pages/404.vue 生成的那份页面复制成 404.html。
//
// 为什么需要这一步：Nuxt 写出来的 404.html 是个空壳。按维护者的说法，它是
// 「能渲染应用任意页面的 fallback」而不是一个 404 页面——动态路由的存在让
// 构建期无法断定某个 URL 真的是错的，只能等浏览器里 JS 跑起来才知道。
//
// 对一个纯静态站，这个取舍不能接受：不跑 JS 就是白页，爬虫看到的也是空的。
// 所以另生成一份带完整内容的 /404，在这里覆盖过去。
//
// 这一步必须跑在 nuxt generate 之后——空壳是 Nitro 在收尾阶段写的，
// 跑在前面会被它盖掉。

import { copyFile, access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../.output/public', import.meta.url))
const source = `${publicDir}/404/index.html`
const target = `${publicDir}/404.html`

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(source))) {
  // 静默跳过最糟：产物里会留着一个空壳 404，而构建显示成功。
  console.error(`找不到 ${source}`)
  console.error('pages/404.vue 可能被删了，或者 /404 没被预渲染。')
  process.exit(1)
}

const html = await readFile(source, 'utf8')
if (!html.includes('没有这一页')) {
  console.error(`${source} 里没有 404 页面的内容，可能是渲染失败了。`)
  process.exit(1)
}

await copyFile(source, target)
console.log(`已生成 404.html（${html.length} 字节，含完整内容）`)
