<script setup lang="ts">
// 默认版式：页头 + 正文 + 页脚。侧边栏由页面自己排，
// 因为首屏不需要它，而文档页需要。
</script>

<template>
  <div class="shell">
    <SiteHeader />
    <slot />
    <SiteFooter />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
