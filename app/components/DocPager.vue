<script setup lang="ts">
import type { NavItem } from '~/data/navigation'

// 上一篇 / 下一篇。顺序取自侧边栏那份清单，与目录里看到的顺序一致。
defineProps<{ prev?: NavItem; next?: NavItem }>()
</script>

<template>
  <nav class="pager">
    <NuxtLink v-if="prev" :to="prev.path" class="cell">
      <span class="label">上一篇</span>
      <span class="title">{{ prev.title }}</span>
    </NuxtLink>
    <span v-else class="cell empty" />

    <NuxtLink v-if="next" :to="next.path" class="cell next">
      <span class="label">下一篇</span>
      <span class="title">{{ next.title }}</span>
    </NuxtLink>
    <span v-else class="cell empty" />
  </nav>
</template>

<style scoped>
.pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 56px;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
}

.cell.next {
  text-align: right;
}

.cell.empty {
  border: none;
}

a.cell:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.label {
  font-size: 12px;
  color: var(--fg-dim);
}

.title {
  font-size: 14.5px;
  font-weight: 600;
}
</style>
