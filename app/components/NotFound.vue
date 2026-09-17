<script setup lang="ts">
import { flatDocs } from '~/data/navigation'

// 「没有这一页」的界面。两处在用：pages/404.vue（静态生成的 404.html）
// 与 error.vue（应用内导航到错地址时）。同一个界面写两遍迟早会飘。
defineProps<{
  /** 状态码，取不到时不显示。 */
  statusCode?: number
  /** 出错时的补充说明。 */
  message?: string
}>()

// 兜底给几个入口。走错路的人多半是想找某一篇，直接给目录比给一句
// 「页面不存在」有用。
const picks = flatDocs.slice(0, 3)
</script>

<template>
  <div class="nf">
    <p v-if="statusCode" class="code">{{ statusCode }}</p>
    <h1 class="title">没有这一页</h1>
    <p class="msg">
      {{ message || '这个地址不在文档目录里，可能写错了，也可能那篇已经改了名字。' }}
    </p>

    <p class="back">
      <NuxtLink to="/">回到文档索引</NuxtLink>
    </p>

    <ul class="picks">
      <li v-for="item in picks" :key="item.path">
        <NuxtLink :to="item.path">{{ item.title }}</NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.nf {
  max-width: 720px;
  margin: 0 auto;
  padding: 96px 24px 64px;
  width: 100%;
}

.code {
  margin: 0;
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--fg-dim);
}

.title {
  margin: 8px 0 0;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
}

.msg {
  margin: 16px 0 0;
  color: var(--fg-soft);
}

.back {
  margin: 28px 0 0;
  font-size: 15px;
}

.picks {
  margin: 40px 0 0;
  padding: 20px 22px;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 14px;
  line-height: 2;
}

.picks::before {
  content: "或者从这里开始";
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--fg-dim);
}

@media (max-width: 720px) {
  .nf {
    padding: 56px 16px 48px;
  }

  .title {
    font-size: 25px;
  }
}
</style>
