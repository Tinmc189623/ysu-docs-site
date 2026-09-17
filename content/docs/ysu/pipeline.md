---
title: "单向管线"
description: "输入是一段 HTML 字节和一个基准地址，输出是一块 RGBA 像素。中间有六道工序，每一道的产物是下一道的输入。"
---

输入是一段 HTML 字节和一个基准地址，输出是一块 RGBA 像素。中间有六道工序，每一道的产物是下一道的输入。

```
html::Tokenizer     →  Token 流
dom::TreeBuilder    →  Document（DOM 树）
css::Parser         →  StyleSheet
style::Cascade      →  StyleMap（每个元素的计算样式）
layout::Tree        →  带几何的盒子树
paint               →  DisplayList（绘制命令）
render::Renderer    →  像素
```

**每一步都能单独调用。** 写测试、查问题时可以从任意一环切进去，不用整条链跑一遍。想验选择器匹配，直接喂一段 CSS 和一棵 DOM；想验渲染，直接构造一个显示列表。

`crates/ysu/src/lib.rs` 的模块文档里就画了这条线：

```rust
pub mod address;   // 地址栏输入的解析
pub mod css;       // 词法、选择器、值与规则解析
pub mod dom;       // 节点树与查询
pub mod engine;    // 门面，把下面这些串起来
pub mod html;      // 词法分析、字符引用解码与树构建
pub mod layout;    // 盒子树与布局
pub mod net;       // HTTP/1.1、TLS、字符集嗅探
pub mod pages;     // 内核自己提供的页面
pub mod paint;     // 绘制命令的生成
pub mod render;    // wgpu 渲染器
pub mod style;     // 从匹配到的声明算出最终属性值
```

## 数据在每一道长什么样

**Token。** HTML 词法产出七种记号：DOCTYPE、起始标签、结束标签、注释、CDATA 段、文本、结束。每个标签带名字、属性表、是否自闭合。

**Document。** 一棵 arena 结构的树。节点存在一张表里，彼此用 `NodeId`（一个 `usize` 的包装）互相引用，不用指针——这样树里不会出现引用计数成环。

**StyleSheet。** 若干条规则，每条带选择器列表与声明表。`@media` 在这一步就地按当前视口求值，满足条件的规则直接提升到外层。

**StyleMap。** 一个从 `NodeId` 到 `ComputedStyle` 的映射。每个元素一份最终属性值，继承已经算完。

**LayoutTree。** 盒子树。DOM 节点在这里被翻译成块盒、行内盒、表格盒、弹性盒，补上匿名块，算出每个盒子的位置与尺寸，文字被折进行盒里。

**DisplayList。** 一串绘制命令。六种：填矩形、画边框、画文字、画图片、推裁剪切、弹裁剪切。

**像素。** 物理像素的 RGBA 缓冲，紧凑排列。

## 为什么是单向的

```rust
// crates/ysu/src/lib.rs
pub use engine::Engine;
```

`Engine` 是这条线的门面。它持有文档、样式表、布局树，按顺序推进，并在需要的时候报告「页面还引用了哪些外部样式表」。

单向意味着每一层不需要知道上面发生了什么。布局不用管样式表是从 `<style>` 来的还是从网络取回来的——它拿到 `StyleMap` 就干活。绘制不用管盒子是怎么算出来的——它遍历树，生成命令。

这条约束的代价是没法做「布局发现问题再回去改样式」这类优化。收益是每一层可以单独测试、单独替换。

## 三个可以替换的点

**渲染后端。** `render/` 只有一个职责：把 `DisplayList` 翻译成 draw call。换一套 GPU API 只动这一个模块，布局与绘制不受影响。

**文本整形。** `layout/text.rs` 把工作交给 cosmic-text。换一个整形器只动这一个文件，接口是 `layout(&str, &TextStyle, Option<f32>) -> TextLayout`。

**网络。** `net/` 是一个独立的 HTTP/1.1 客户端加 rustls。换一个 HTTP 库动的是它，不管是谁在调。

## 数据的形状有个共同点

中间产物都是「可以打印出来看」的普通数据，没有藏着闭包、没有回调、没有生命周期纠缠。

`DisplayList` 是个典型的例子：一串 enum，每个变体带自己的字段，`Text` 命令里放的是 `String` 而不是切片。代价是每帧多做几次分配；收益是它可以被构造、被比较、被单元测试、被写进调试输出。

`printable.rs` 那样的调试设施能成立，靠的就是这一点。

## 一次渲染的完整路径

拿外壳里的一次滚动举例：

```
滚轮事件
  → Viewport::wheelEvent 改滚动位置
  → ysu_engine_render(engine, scroll_x / zoom, scroll_y / zoom)
       → Engine::display_list_region(可见范围)
            → 遍历布局树
            → Painter 只生成落在可见范围内的命令
       → Renderer::render(display_list, viewport, scroll, zoom, scale)
            → 顶点在着色器里按 (页面坐标 - 滚动) * 缩放 * 像素比 变换
            → 按裁剪范围切批次
            → 画进离屏纹理
            → 读回 CPU 内存
  → 外壳用 QImage 包住像素贴到部件上
```

注意第 3 步：布局没有重算。滚动只是换了一套可见范围去取绘制命令。

改视口尺寸或者改缩放就不同了——那两条会触发重新布局，因为断行位置会变。
