import type { ReactNode } from 'react'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { baseOptions } from '@/lib/layout.shared'

// 首屏的版式：只要页头，不要侧边栏。文档页的侧边栏是另一套版式的事。
export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>
}
