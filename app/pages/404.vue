<script setup lang="ts">
// 这个页面存在的唯一目的，是让构建期生成一份**带完整内容**的 404 页面。
//
// Nuxt 生成的 404.html 是一个空壳——它按 fallback 处理，要等浏览器里 JS
// 跑起来才渲染。纯静态站不能这样：不跑 JS 就是一片白。
//
// 所以这里放一个真实路由 /404，生成出 404/index.html，
// 构建结束之后由 scripts/make-404.mjs 把它复制成 404.html 覆盖掉那个空壳。
// 站点里没有任何地方链接到它。
useSeoMeta({
  title: '没有这一页 · YSU 渲染内核文档',
  robots: 'noindex',
})
</script>

<template>
  <NotFound :status-code="404" />
</template>
