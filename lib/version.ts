import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 读仓库根的 version.toml，取出页脚要显示的那个内核版本号。
 *
 * 数字只写在那一份文件里，页脚不另抄一遍——两处各写一份迟早会对不上。
 *
 * 路径从进程的工作目录算起。Next 的构建与启动都从项目根跑，所以 `next build`
 * 与 `next start` 都能读到。这里不用 `import.meta.url`：服务端代码是打过包的，
 * 那个路径会指到 .next 里去，不是源文件所在的位置。
 *
 * 格式就一个 [version] 段加几个键，不引 TOML 解析库。
 * 读不出来就抛错——在页脚上显示一个假版本号，比构建失败糟糕得多。
 */
export function readKernelVersion(): string {
  const path = join(process.cwd(), 'version.toml')
  const text = readFileSync(path, 'utf8')

  let inVersionSection = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }
    if (line.startsWith('[')) {
      inVersionSection = line === '[version]'
      continue
    }
    if (!inVersionSection) {
      continue
    }
    const [key, value] = line.split('=')
    if (key?.trim() === 'kernel_version') {
      return value.trim().replace(/^["']|["']$/g, '')
    }
  }

  throw new Error(`version.toml 里没有读到 kernel_version：${path}`)
}

/** 页脚用的版本号。模块加载时读一次，构建期就定下来了。 */
export const kernelVersion = readKernelVersion()
