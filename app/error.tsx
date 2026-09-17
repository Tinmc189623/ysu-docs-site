'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * 运行期出错的兜底界面。
 *
 * 只接一类情况：某个页面在渲染时抛了错。走错地址不走这里，走的是
 * app/not-found.tsx——那边是 404，这边是 500，两回事。
 *
 * 必须是客户端组件，这是 App Router 的约定：错误边界得在浏览器里挂。
 * 也正因为如此，这个文件不能读 version.toml 那类服务端才有的东西。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 控制台留一条，方便本地开发时看清到底哪一步炸了。
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-24 pb-16 max-sm:px-4 max-sm:pt-14">
      <p className="m-0 font-mono text-[13px] tracking-[0.08em] text-fd-muted-foreground">
        500
      </p>
      <h1 className="mt-2 mb-0 text-[30px] font-bold leading-snug max-sm:text-[25px]">
        页面渲染时出了问题
      </h1>
      <p className="mt-4 mb-0 text-fd-muted-foreground">
        这一页没能渲染出来。可以重试一次，或者先回文档索引。
      </p>

      <p className="mt-7 mb-0 flex gap-4 text-[15px]">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer border-0 bg-transparent p-0 text-[15px] text-fd-primary"
        >
          重试
        </button>
        <Link href="/">回到文档索引</Link>
      </p>
    </main>
  )
}
