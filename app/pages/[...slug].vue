<script setup lang="ts">
import { neighboursOf, sectionOf } from '~/data/navigation'

const route = useRoute()

// 一页文档就是一篇 markdown。路径与 docs/public 下的文件一一对应，
// 取的键用 route.path，所以不存在找不到的情况——找不到就是那张清单里漏了。
const { data: doc } = await useAsyncData(`doc:${route.path}`, () =>
  queryCollection('docs').path(route.path).first(),
)

if (!doc.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '没有这一篇',
    message: `目录里没有 ${route.path}，它可能还没写，或者已经改名。`,
  })
}

const section = sectionOf(route.path)
const { prev, next } = neighboursOf(route.path)

// 正文里的目录，交给右侧那一列。
const tocLinks = computed(() => doc.value?.body?.toc?.links ?? [])

useSeoMeta({
  title: () => (doc.value?.title ? `${doc.value.title} · YSU 渲染内核文档` : 'YSU 渲染内核文档'),
  description: () => doc.value?.description ?? '',
})
</script>

<template>
  <div class="doc">
    <aside class="doc-side">
      <DocsSidebar />
    </aside>

    <main class="doc-main">
      <p class="crumb">
        <NuxtLink to="/">文档</NuxtLink>
        <template v-if="section"> / {{ section.title }}</template>
      </p>
      <article class="prose">
        <ContentRenderer v-if="doc" :value="doc" />
      </article>
      <DocPager :prev="prev" :next="next" />
    </main>

    <aside class="doc-aside">
      <DocToc :links="tocLinks" />
    </aside>
  </div>
</template>
