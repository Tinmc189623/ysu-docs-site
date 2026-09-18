---
title: "层叠与继承"
description: "从「哪些规则匹配这个元素」到「这个元素最终用什么值」。1334 行，29 条单元测试。"
---

从「哪些规则匹配这个元素」到「这个元素最终用什么值」。1334 行，29 条单元测试。

## 三个来源

```rust
pub enum Origin {
    UserAgent,   // 内置默认样式表
    Author,      // 页面自己的样式
    Inline,      // 元素上的 style 属性
}
```

优先级从低到高。`!important` 会翻转顺序——用户代理表里的 `!important` 比作者表里的 `!important` 高，这是规范为了可访问性留的口子。

## 解析过程

```rust
pub struct StyleResolver<'a> { /* ... */ }

impl<'a> StyleResolver<'a> {
    pub fn new(document: &'a Document, sheets: &'a [StyleSheet]) -> Self;
    pub fn with_media(mut self, media: MediaContext) -> Self;
    pub fn with_state(mut self, state: ElementState) -> Self;
    pub fn compute_tree(&self) -> StyleMap;
    pub fn compute_element(&self, /* ... */) -> /* ... */;
}
```

`StyleMap` 是 `HashMap<NodeId, ComputedStyle>`：

```rust
pub type StyleMap = HashMap<NodeId, ComputedStyle>;
```

便利函数：

```rust
pub fn compute_styles(document: &Document, sheets: &[StyleSheet]) -> StyleMap;
pub fn compute_styles_with_viewport(document: &Document, sheets: &[StyleSheet], width: f64, height: f64) -> StyleMap;
```

对一个元素，解析过程是：

1. 收集所有匹配它的声明，每条记下来源、优先级、在样式表里的顺序
2. 按这三者排序
3. 逐条应用到一份初始样式上，后者覆盖前者
4. 没被任何声明覆盖的可继承属性从父元素取

排序的判据是 `(来源与 !important, 优先级, 出现顺序)`。第三项看着多余——同名属性后面的覆盖前面的，没有它的话顺序不稳定。

## 内置默认样式表

```rust
pub fn user_agent_sheet() -> &'static StyleSheet;
pub const USER_AGENT_CSS: &str;
```

`USER_AGENT_CSS` 是一段写死在代码里的 CSS，内容大致是：

```css
html, body, div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, dl, dt, dd,
blockquote, pre, form, fieldset, hr, section, article, header,
footer, nav, aside, main, figure, figcaption, address, center {
    display: block;
}
li { display: list-item; }
table { display: table; }
caption { display: table-caption; text-align: center; }
thead, tbody, tfoot { display: table-row-group; }
tr { display: table-row; }
td, th { display: table-cell; }
head, title, meta, link, style, script, base, noscript, template { display: none; }
body { margin: 8px; }
h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
/* h2 到 h6 同理 */
strong, b { font-weight: bold; }
em, i, cite, var, dfn { font-style: italic; }
u, ins { text-decoration: underline; }
a { text-decoration: underline; color: #0000ee; }
a:visited { color: #551a8b; }
ul, ol { margin: 1em 0; padding-left: 40px; }
blockquote { margin: 1em 40px; }
pre { font-family: monospace; white-space: pre; margin: 1em 0; }
code, kbd, samp, tt { font-family: monospace; }
hr { border: 1px inset; margin: 0.5em auto; }
table { border-collapse: separate; border-spacing: 2px; }
td, th { padding: 1px; }
th { font-weight: bold; text-align: center; }
img { display: inline-block; }
input, textarea, select, button { display: inline-block; }
small { font-size: 0.83em; }
big { font-size: 1.17em; }
mark { background-color: yellow; color: black; }
```

它被解析成一份普通的 `StyleSheet`，走和页面样式完全相同的解析路径。所以 `h1 { font-size: 2em }` 里的 `em` 也是按同样的规则换算的。

**一份没有 CSS 的 HTML 长什么样，完全由这段文字决定。** 调版式的时候先看这里。

几个细节：

- `body { margin: 8px }`——就是默认样式表带来的那圈白边
- `head, title, meta, link, style, script` 那一堆 `display: none`，这是为什么它们不出现在画面上
- `hr { border: 1px inset }` 里 `inset` 现在解析不了（边框样式关键字只识别几种），所以 `hr` 画不出线
- `ul, ol` 的 `padding-left: 40px` 是项目符号能显示出来的原因

## 继承

可继承的属性在 `ComputedStyle::inherit_from` 里列着：

```rust
pub fn inherit_from(parent: &ComputedStyle) -> Self {
    let mut style = Self::initial();
    style.color = parent.color;
    style.font_family = parent.font_family.clone();
    style.font_size = parent.font_size;
    style.font_weight = parent.font_weight;
    style.italic = parent.italic;
    style.line_height = parent.line_height;
    style.text_align = parent.text_align;
    style.white_space = parent.white_space;
    style.visibility = parent.visibility;
    style
}
```

九项：文字颜色、字体族、字号、字重、斜体、行高、水平对齐、空白处理、可见性。其余全部回到初始值。

**这份名单就是「哪些 CSS 属性可继承」在内核里的全部体现。** 加一个新的可继承属性时，改这里，别忘了。

根元素走另一条路：

```rust
pub fn for_root() -> Self {
    Self::initial()
}
```

根元素的字号按初始值算（16px），`rem` 的基准就是它。

## 相对单位的换算

`em` 与百分比的字号在层叠阶段换算——因为元素自己的字号要先定下来，`em` 才有基准。顺序是先算父元素的字号，再算自己的。

`rem` 要等根元素算完，所以解析是两趟：先根，再其余。

## 元素状态

```rust
pub fn with_state(mut self, state: ElementState) -> Self;
```

匹配 `:hover` 这类伪类时要用。现在没有任何地方提供状态（四项全为假），所以 `:hover` 规则不会命中。

## 样式表是怎么攒起来的

一次加载的完整顺序：

1. 内置默认样式表（`UserAgent` 来源）
2. 文档里所有 `<style>` 元素的内容，按出现顺序
3. 外部样式表，每取回一份就并入一次
4. 每个元素自己的 `style` 属性（`Inline` 来源）

第 2 与第 3 步的交错顺序在这里被拉平了——外部样式表总是排在所有 `<style>` 之后，而不是按它们在文档里出现的位置。写页面的时候如果把 `<link>` 放在 `<style>` 前面并依赖这个顺序，结果会和预期不同。

## `@media` 在哪求值

在 CSS 解析阶段，不在层叠阶段。`MediaContext` 带着视口宽高传进解析器，满足条件的规则直接提升到外层。

好处是层叠那边不用再管媒体查询。代价是**改视口尺寸要重新解析样式表**——缩放窗口会走这条路。

## 测试

29 条，覆盖来源与 `!important` 的排序、优先级的比较、继承链、`em` 与百分比字号的换算、简写的展开、以及属性值类型不匹配时的丢弃。

## 相关的偏离

`@media only screen` 恒不匹配（`only` 关键字没有分支），这是现实页面最常见写法之一，影响面不小。见[已知限制](./known-limitations.md)。
