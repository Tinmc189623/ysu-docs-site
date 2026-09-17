<script setup lang="ts">
import type { NuxtError } from '#app'

// 运行期出错时用的页面：应用内导航到一个不存在的地址、或者某个页面
// 在浏览器里渲染时抛错，都会走到这里。
//
// 它不套用 layouts/default，而是自己把页头页脚摆一遍——这是 Nuxt 的约定，
// error.vue 替代整个应用外壳，不叠加在版式上。
//
// 直接访问错地址的情形不走这里，而是由静态服务器交给 404.html，
// 那份由 pages/404.vue 生成，见那个文件里的说明。
const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)

useSeoMeta({
  title: () => `${props.error?.statusCode ?? '错误'} · YSU 渲染内核文档`,
  robots: 'noindex',
})
</script>

<template>
  <div class="shell">
    <SiteHeader />
    <main class="wrap">
      <NotFound
        :status-code="isNotFound ? 404 : props.error?.statusCode"
        :message="isNotFound ? undefined : '页面渲染时出了问题。'"
      />
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.wrap {
  flex: 1;
}
</style>
