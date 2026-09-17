<script setup lang="ts">
import { sections } from '~/data/navigation'

// 目录树整棵渲染出来，不做折叠。文档一共四十来篇，摊开比让人一次次点开
// 更快找到东西；窄屏上整块收进 <details>，见下面的样式。
const route = useRoute()
</script>

<template>
  <nav class="side" aria-label="文档目录">
    <details class="side-fold" open>
      <summary class="side-summary">目录</summary>
      <div class="side-body">
        <section v-for="section in sections" :key="section.slug" class="group">
          <p class="group-title">{{ section.title }}</p>
          <ul class="list">
            <li v-for="item in section.items" :key="item.path">
              <NuxtLink
                :to="item.path"
                class="item"
                :class="{ current: route.path === item.path }"
              >
                {{ item.title }}
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </details>
  </nav>
</template>

<style scoped>
.side {
  font-size: 13.5px;
}

.side-summary {
  display: none;
}

.group + .group {
  margin-top: 22px;
}

.group-title {
  margin: 0 0 8px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  text-transform: uppercase;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-left: 1px solid var(--line);
}

.item {
  display: block;
  padding: 4px 10px;
  margin-left: -1px;
  border-left: 2px solid transparent;
  color: var(--fg-soft);
  text-decoration: none;
  line-height: 1.5;
}

.item:hover {
  color: var(--fg);
}

.item.current {
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
}

@media (max-width: 900px) {
  .side-summary {
    display: block;
    cursor: pointer;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-weight: 600;
    color: var(--fg);
  }

  .side-body {
    margin-top: 16px;
  }
}
</style>
