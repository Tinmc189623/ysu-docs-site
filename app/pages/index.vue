<script setup lang="ts">
import { flatDocs, sections } from '~/data/navigation'

// 首屏。它不渲染任何一篇文档，只把六个分组摆出来当入口。
useSeoMeta({
  title: 'YSU 渲染内核文档',
  description:
    'YSU 渲染内核的文档：HTML 与 CSS 解析、DOM、样式、布局、绘制、渲染与网络各层的实现说明，以及 C ABI 参考。',
})
</script>

<template>
  <main>
    <section class="hero">
      <h1 class="hero-title">YSU 渲染内核</h1>
      <p class="hero-lede">
        YSU 负责把一段 HTML 变成一块像素。它自己做词法、树构建、CSS 选择器匹配、层叠、
        布局、绘制与光栅化，不调用系统自带的网页控件。
      </p>
      <p class="hero-note">
        这些文档按同一条顺序排：先讲清两个组件各自管什么，再讲怎么把它编出来跑起来，
        然后沿内核那条单向管线从字节走到像素。要看每条特性的落地情况，直接翻
        <NuxtLink to="/ysu/support-status">支持范围</NuxtLink> 与
        <NuxtLink to="/ysu/known-limitations">已知限制</NuxtLink>。
      </p>
    </section>

    <section class="sections">
      <NuxtLink
        v-for="section in sections"
        :key="section.slug"
        :to="section.items[0]?.path ?? '/'"
        class="card"
      >
        <div class="card-head">
          <h2 class="card-title">{{ section.title }}</h2>
          <span class="card-count">{{ section.items.length }} 篇</span>
        </div>
        <p class="card-blurb">{{ section.blurb }}</p>
        <ul class="card-entries">
          <li v-for="item in section.items.slice(0, 4)" :key="item.path">{{ item.title }}</li>
          <li v-if="section.items.length > 4">……</li>
        </ul>
      </NuxtLink>
    </section>

    <section class="hero">
      <p class="hero-note">全部 {{ flatDocs.length }} 篇，按阅读顺序排在同一份目录里。</p>
    </section>
  </main>
</template>
