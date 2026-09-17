<script setup lang="ts">
// 版本号在构建期从仓库根的 version.toml 读进来（见 nuxt.config.ts），
// 页面这边不硬编——两处各写一份迟早会对不上。
const { kernelVersion } = useRuntimeConfig().public
</script>

<template>
  <footer class="foot">
    <div class="foot-inner">
      <p class="line">
        <span class="dim">内核版本</span>
        <span class="mono">{{ kernelVersion }}</span>
      </p>
      <p class="copy">Copyright © 2026 Nexsteaduser. All Rights Reserved.</p>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  margin-top: auto;
  border-top: 1px solid var(--line);
}

.foot-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 20px 24px 28px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: baseline;
  justify-content: space-between;
}

.line {
  margin: 0;
  font-size: 13px;
}

.dim {
  color: var(--fg-dim);
  margin-right: 8px;
}

.mono {
  font-family: var(--mono);
}

.copy {
  margin: 0;
  font-size: 12.5px;
  color: var(--fg-dim);
}
</style>
