---
title: "内核门面"
description: "Engine 把解析、样式、布局、绘制串起来。它是内核对外的唯一门面。27 条单元测试。"
---

`Engine` 把解析、样式、布局、绘制串起来。它是内核对外的唯一门面。27 条单元测试。

## 状态

```rust
pub struct Engine {
    /* 文档、样式来源、已取回的外部样式表、样式表、布局引擎、布局树、视口、基准地址 */
}
```

它持有一次加载的全部状态。实例之间不共享任何东西——同一份 HTML 喂给两个实例，各自解析、各自排版。

## 生命周期

没有状态枚举，生命周期就是一组方法的调用顺序：

```
Engine::new(width, height)
  → load_html(html) 或者 load_html_with_base(html, base_url)
       → 收集文档里的 <style> 与 <link rel="stylesheet">
       → 重建样式表
       → 重排
  → stylesheet_links()          报告还需要取哪些外部样式表
  → set_linked_stylesheet(url, css)   收一份就重建一次
  → set_viewport(w, h)          尺寸变了就重排
  → display_list() / display_list_region(visible)
  → element_at(x, y) / fragment_node_at(x, y)
```

## 加载

```rust
impl Engine {
    pub fn new(width: f64, height: f64) -> Self;
    pub fn load_html(&mut self, html: &str);
    pub fn load_html_with_base(&mut self, html: &str, base_url: &str);
}
```

`load_html` 不带基准地址，页面里的相对地址补不全。要取回外部样式表就得用 `load_html_with_base`，否则 `stylesheet_links` 交回来的是原样的相对路径。

加载做的事情是：解析成 DOM、收集样式来源、重建样式表、重排。**换文档时已取回的外部样式表会清空**——上一页的 `style.css` 不该被当成这一页的。

## 样式来源

```rust
pub enum SheetSource {
    Inline(String),   // <style> 元素的内容
    Link(String),     // <link rel="stylesheet"> 的地址
}
```

收集时按文档顺序扫，`<link>` 上带 `media` 属性且不匹配当前媒体环境时整条跳过。

这个顺序决定了层叠里的先后：`<style>` 与 `<link>` 交错出现时，它们按在文档里的位置排。这一条与「外部样式表总是排在所有 `<style>` 之后」的直觉不同——上面《层叠与继承》里提到过。

## 外部样式表

内核不取样式表，它只报告有哪些要取：

```rust
pub fn stylesheet_links(&self) -> Vec<String>;
pub fn set_linked_stylesheet(&mut self, url: &str, css: &str);
```

`stylesheet_links` 返回页面引用的全部地址。调用方逐个去取，每取回一份调一次 `set_linked_stylesheet`，内核重建样式表并重排。

**不在引用列表里的 URL 会被忽略。** 这是防呆：拿一份陈旧的样式表回来说「这是第三份」，不应该被接受。

**每收一份就重排一次。** 一份页面引三份样式表时，画面会变化三次。这是设计如此，不是渲染出错——逐步更新比等全部到齐再显示响应更快。

## 视口

```rust
pub fn set_viewport(&mut self, width: f64, height: f64);
pub fn viewport(&self) -> (f64, f64);
```

`set_viewport` 在尺寸没变化时直接返回，不重排——尺寸不变的重绘不该触发重新布局。真的变了就重算样式再排一次，因为断行位置、百分比宽度、`vw` 与 `vh` 都要跟着变。

**缩放不在这一层。** `Engine` 只认一个视口尺寸，没有独立的缩放参数。要让「放大」改变换行位置，就把变窄的尺寸传进来；`Renderer` 那边的 `set_view` 收的缩放管的是成像，两者不是一回事。

## 输出

```rust
pub fn display_list(&self) -> DisplayList;
pub fn display_list_region(&self, visible: Rect) -> DisplayList;
pub fn document_height(&self) -> f64;
pub fn layout_tree(&self) -> &LayoutTree;
pub fn styles(&self) -> &StyleMap;
pub fn stylesheets(&self) -> &[StyleSheet];
pub fn layout_engine_mut(&mut self) -> &mut LayoutEngine;
```

`display_list_region` 是滚动时用的：只生成落在可见范围内的命令。

`document_height` 返回整页高度，用来算滚动范围：视口之外还剩下多少内容。

后面那几个返回内部结构的引用，是给测试和内部使用者用的。

## 命中测试

```rust
pub fn element_at(&self, x: f64, y: f64) -> Option<NodeId>;
pub fn fragment_node_at(&self, x: f64, y: f64) -> Option<NodeId>;
```

两个方向。**链接命中用后者**：

```rust
// src/engine.rs
//! 行内元素在盒子树里没有自己的盒子，只按盒子找不出「这一点压在哪个链接上」。
```

`fragment_node_at` 找到压在该点上的文字片段，返回它的来源节点，调用方顺着它往上找祖先就是链接。

## 一个使用例子

```rust
use ysu::Engine;

let mut engine = Engine::new(1280.0, 800.0);
engine.load_html_with_base("<h1>你好</h1>", "https://example.com/");

println!("文档高度 {:.1}", engine.document_height());
println!("样式表 {} 份", engine.stylesheets().len());

for url in engine.stylesheet_links() {
    println!("需要取回：{url}");
    // engine.set_linked_stylesheet(&url, css);
}

let list = engine.display_list();
let (rects, borders, texts, images) = list.summary();
println!("绘制命令 {} 条：矩形 {rects} 边框 {borders} 文字 {texts} 图片 {images}", list.len());
```

## 重排的代价

`relayout` 做的是「算样式 + 布局 + （绘制是按需的）」。它在这些时候被调用：

- 加载新文档之后
- 收下一份外部样式表之后
- 视口尺寸真的变了之后

滚动**不触发它**。滚动只是换一套可见范围去取绘制命令。

所以滚一屏和一个段落里改一个字，代价差了两三个数量级。

## 测试

27 条，覆盖加载与重载、样式表收集的顺序、`media` 属性的过滤、外部样式表的接收与忽略、视口变化时的重排与不重排、缩放的换算、以及命中测试的两种方向。

有一条专门钉住「换文档时已取回的样式表被清空」——这个行为漏掉的话，会在打开第二个页面时表现为「莫名其妙带上了上一页的样式」。
