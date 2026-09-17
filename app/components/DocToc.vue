<script setup lang="ts">
import type { TocLink } from '@nuxt/content'

// 本页的标题目录。标题只到 h3，再深一层的锚点在侧栏里排不下。
const props = defineProps<{ links: TocLink[] }>()

const activeId = ref('')

// 用 IntersectionObserver 标出当前读到哪一节。比每帧算一遍所有标题的
// 位置省事，也不会在长页面上卡顿。
let observer: IntersectionObserver | undefined

onMounted(() => {
  const headings = props.links
    .map((link) => document.getElementById(link.id))
    .filter((node): node is HTMLElement => node !== null)

  if (headings.length === 0) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id
        }
      }
    },
    // 顶部留出页头的高度，否则第一个标题永远不会被认为「离开了视野」。
    { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
  )

  for (const heading of headings) {
    observer.observe(heading)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <nav v-if="links.length > 0" class="toc" aria-label="本页目录">
    <p class="toc-title">本页</p>
    <ul class="toc-list">
      <li v-for="link in links" :key="link.id">
        <a
          :href="`#${link.id}`"
          class="toc-link"
          :class="{ active: activeId === link.id, sub: link.depth === 3 }"
        >
          {{ link.text }}
        </a>
        <ul v-if="link.children?.length" class="toc-list">
          <li v-for="child in link.children" :key="child.id">
            <a
              :href="`#${child.id}`"
              class="toc-link sub"
              :class="{ active: activeId === child.id }"
            >
              {{ child.text }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.toc {
  position: sticky;
  top: 80px;
  font-size: 13px;
}

.toc-title {
  margin: 0 0 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
  text-transform: uppercase;
}

.toc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc-link {
  display: block;
  padding: 3px 0;
  color: var(--fg-dim);
  text-decoration: none;
  line-height: 1.5;
}

.toc-link.sub {
  padding-left: 12px;
  font-size: 12.5px;
}

.toc-link:hover {
  color: var(--fg);
}

.toc-link.active {
  color: var(--accent);
}
</style>
