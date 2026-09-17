<script setup lang="ts">
import { sections } from '~/data/navigation'

// 页头的横向导航。它只列分组，不列具体文档——具体文档交给侧边栏，
// 两处都列一遍会让页头在窄屏上挤成一团。
const nav = sections.map((section) => ({
  title: section.title,
  slug: section.slug,
  path: section.items[0]?.path ?? '/',
}))
</script>

<template>
  <header class="head">
    <div class="head-inner">
      <NuxtLink to="/" class="brand">
        <span class="brand-name">YSU</span>
        <span class="brand-sub">渲染内核</span>
      </NuxtLink>
      <nav class="nav">
        <NuxtLink v-for="item in nav" :key="item.slug" :to="item.path" class="nav-link">
          {{ item.title }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.head {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}

.head-inner {
  display: flex;
  align-items: center;
  gap: 32px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.brand-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.brand-sub {
  font-size: 12px;
  color: var(--fg-dim);
}

.nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}

.nav-link {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13.5px;
  color: var(--fg-dim);
  text-decoration: none;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--fg);
  background: var(--bg-soft);
}

.nav-link.router-link-active {
  color: var(--accent);
  background: var(--accent-soft);
}

@media (max-width: 720px) {
  .head-inner {
    gap: 16px;
    padding: 0 16px;
  }

  .brand-sub {
    display: none;
  }
}
</style>
