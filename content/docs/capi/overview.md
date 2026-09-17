---
title: "C ABI 总览"
description: "crates/ysu-capi 把 YSU 包成一层 C 接口。C++ 外壳通过它调内核，别的语言想用 YSU 也是走这条路。"
---

`crates/ysu-capi` 把 YSU 包成一层 C 接口。C++ 外壳通过它调内核，别的语言想用 YSU 也是走这条路。

这一层不是「自动生成的绑定」，是手写的。26 个 `extern "C"` 函数，一个手写头文件，两边由测试盯着参数个数是否一致。

## 边界上有什么

**只有一个东西：像素。** 建实例、喂 HTML、设视口、渲染一帧、拿到一块 RGBA 图。外壳从头到尾不知道 wgpu 是什么，也不需要知道。

GPU 设备、渲染目标、字形图集、着色器、管线的生命周期全在 Rust 里。C 侧拿到的是一个不透明指针 `YsuEngine *`，里面有什么它看不见。

**第二样东西是字符串。** 页面标题、链接地址、外部样式表的 URL 列表、内置页面的 HTML、地址解析结果——这些都从内核以 `char *` 的形式交出去，用完由调用方释放。

就这么两样。没有回调表，没有虚函数表，没有跨语言的对象模型。

## 为什么这么切

如果渲染改成交换链或者共享纹理，外壳就得知道 wgpu 的设备、表面、重建时机、释放顺序。这些都是「必须知道才能用对」的知识，泄漏到 C++ 里就是永久的负担——每加一个平台后端就要重来一遍。

现在的代价是每次渲染有一趟 GPU 到 CPU 的回读，多一份拷贝。换来的是 26 个函数、一个不透明指针、两种数据形状。

## 一帧的生命周期

```c
YsuEngine *engine = ysu_engine_new(1280, 800, 1.0);
ysu_engine_load_html(engine, html, "https://example.com/");
const uint8_t *pixels = ysu_engine_render(engine, 0.0, 0.0);
// pixels 由引擎持有，下一次 ysu_engine_render 之前有效
ysu_engine_free(engine);
```

`ysu_engine_render` 做四件事：把显示列表翻成 draw call、画进离屏纹理、读回 CPU 内存、返回首地址。它不是每帧都调用——滚动、加载完、改尺寸、改缩放的时候调用一次。

拿到的像素缓冲不由调用方释放。它是引擎内部一块 `Vec<u8>` 的指针，下一次渲染会原地覆盖。想留着就自己拷一份。

## 26 个函数的分类

| 类别 | 函数 |
| --- | --- |
| 版本 | `ysu_capi_version`、`ysu_engine_version` |
| 错误与内存 | `ysu_last_error`、`ysu_string_free` |
| 实例 | `ysu_engine_new`、`ysu_engine_free` |
| 加载 | `ysu_engine_load_html`、`ysu_engine_load_file` |
| 视口 | `ysu_engine_set_viewport`、`ysu_engine_set_zoom` |
| 查询 | `ysu_engine_document_height`、`ysu_engine_title`、`ysu_engine_link_at` |
| 渲染 | `ysu_engine_render`、`ysu_last_render_ok` |
| 图像 | `ysu_image_width`、`ysu_image_height`、`ysu_image_stride` |
| 外部样式表 | `ysu_engine_stylesheet_links`、`ysu_engine_set_linked_stylesheet` |
| 网络 | `ysu_fetch` |
| 内置页面 | `ysu_page_for`、`ysu_page_loading`、`ysu_page_error` |
| 地址 | `ysu_resolve_address`、`ysu_resolve_link` |

逐个说明见[函数参考](./function-reference.md)。

## 错误处理

没有错误码。三套约定并存：

- **返回指针的函数**：失败返回空指针，原因用 `ysu_last_error()` 取。取一次就清空。
- **返回 `bool` 的函数**：失败返回 `false`。目前只有 `ysu_engine_load_file`。
- **`ysu_resolve_address`**：用出参 `kind` 写回 `YSU_TARGET_INTERNAL` / `YSU_TARGET_FILE` / `YSU_TARGET_REMOTE`。

`ysu_last_error` 是全局的，不是每个引擎一份。多线程同时用多个引擎时，错误信息互相覆盖。

## 三套尺寸的约定

这是最容易搞错的一处，写在这里：

| 参数 | 单位 |
| --- | --- |
| `ysu_engine_new` 的 width / height | **逻辑像素** |
| `ysu_engine_new` 的 scale | 设备像素比 |
| `ysu_engine_set_viewport` 的三个参数 | 同上 |
| `ysu_engine_render` 的 scroll_x / scroll_y | **布局坐标**（CSS 像素） |
| `ysu_engine_render` 返回的像素 | **物理像素** |
| `ysu_image_width` / `height` / `stride` | 物理像素 |
| `ysu_engine_document_height` | 逻辑像素 |
| `ysu_engine_link_at` 的 x / y | **布局坐标** |

两条推论：

把**物理**尺寸当视口传进去是错的。页面会按物理宽度排版，比该有的宽，文字在屏幕上偏小四分之一（在 2 倍屏上）。

滚动量用**屏幕像素**传也是错的。外壳按屏幕像素记滚动，交给内核之前要除以缩放倍数。

## 头部文件

`ui/include/ysu_capi.hpp`。扩展名是 `.hpp` 只因为它主要给 C++ 引，但内容完全是 C 的——所有函数都在 `extern "C"` 里，从 C 里引也成立。

它是手写的，与 `crates/ysu-capi/src/lib.rs` 一一对应。改签名要同时改两边，并把 `YSU_CAPI_VERSION` 加一。

## 例子

`crates/ysu-capi/examples/` 下三个例子直接以 Rust 调这些 ABI 函数——因为 `ysu-capi` 同时产出 rlib，Rust 代码可以像调普通函数一样调 `extern "C"` 函数。它们走的是完全相同的二进制接口，只是不经过 C 编译器。

完整的一段 C 代码见[完整示例](./worked-example.md)。
