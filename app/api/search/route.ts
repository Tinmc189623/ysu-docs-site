import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

// 搜索索引在服务端建，查询走这条路由。
//
// 换成静态导出的话这条就用不了了——本地的 Orama 索引得整个塞进浏览器，
// 那是另一种取舍。这里按服务端渲染部署，所以直接用官方给的服务端实现。
export const { GET } = createFromSource(source)
