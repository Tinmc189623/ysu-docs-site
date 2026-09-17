import { kernelVersion } from '@/lib/version'

/**
 * 全站页脚。两块信息：这批文档对应哪个内核版本，以及版权行。
 *
 * 版本号是构建期从仓库根的 version.toml 读的（见 lib/version.ts），
 * 页面这边不硬编——两处各写一份迟早会对不上。
 *
 * 这是个服务端组件：读文件这一步只在服务端跑，不会进浏览器那侧的包。
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-fd-border">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-5">
        <p className="m-0 text-[13px]">
          <span className="mr-2 text-fd-muted-foreground">内核版本</span>
          <span className="font-mono">{kernelVersion}</span>
        </p>
        <p className="m-0 text-[12.5px] text-fd-muted-foreground">
          Copyright © 2026 Nexsteaduser. All Rights Reserved.
        </p>
      </div>
    </footer>
  )
}
