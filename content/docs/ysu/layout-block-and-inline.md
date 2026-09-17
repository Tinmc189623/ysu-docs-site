---
title: "块级与行内布局"
description: "布局引擎里最核心的两个格式化上下文。crates/ysu/src/layout/engine.rs 有 32 条单元测试。"
---

布局引擎里最核心的两个格式化上下文。`crates/ysu/src/layout/engine.rs` 有 32 条单元测试。

## 入口

```rust
pub struct LayoutEngine { /* ... */ }
pub struct LayoutTree { /* ... */ }

impl LayoutEngine {
    pub fn new(context: LayoutContext) -> Self;
    pub fn set_context(&mut self, context: LayoutContext);
    pub fn context(&self) -> LayoutContext;
    pub fn layout(&mut self, document: &Document, styles: &StyleMap) -> Option<LayoutTree>;
}

impl LayoutTree {
    pub fn document_height(&self) -> f64;
    pub fn descendants(&self) -> Vec<&LayoutBox>;
    pub fn hit_test(&self, x: f64, y: f64) -> Option<&LayoutBox>;
    pub fn fragment_node_at(&self, x: f64, y: f64) -> Option<NodeId>;
}
```

`layout` 的输入是 DOM 加样式表，输出是盒子树。`set_context` 换视口或根字号，之后要重新调 `layout`。

## 块级布局

块级盒在纵向依次堆叠，每个占满包含块的内容宽度。

**盒模型。** 内容盒的宽度按 `width` 定，没有就撑满包含块；高度按内容算，`height` 指定时用指定的。`padding`、`border`、`margin` 依次向外。

**外边距合并。** 两种：相邻兄弟之间、父子之间。取两者中较大的那个作为间隔。

```html
<div style="margin-bottom: 20px"></div>
<div style="margin-top: 30px"></div>
```

这两块之间的间隔是 30 像素，不是 50。

父子合并发生在父元素没有边框、没有内边距、也没有建立新的格式化上下文时：子元素的上外边距会「穿出去」变成父元素的上外边距。

**`auto` 外边距居中。** 左右外边距写成 `auto` 时，在宽度确定的前提下平分剩余空间。

```css
#a { width: 200px; margin: 0 auto }   /* 居中 */
#b { width: 200px }                   /* 靠左 */
```

这两个的差别只在 `auto` 上，判据是 `LengthUnit::Auto`。**纵向的 `auto` 未处理**——规范里它可以用来做垂直居中，这里没有实现。

**尺寸约束。** `min-width` / `max-width` / `min-height` / `max-height` 在 `width` / `height` 之后应用，括住结果。

**`box-sizing` 未实现。** 只有 content-box 语义——`width: 200px; padding: 20px` 的外框是 240 而不是 200。

## 行内布局

行内格式化上下文（IFC）把行内级内容排成一行行。

**行盒的构建。** 从包含块的左边界开始，逐个放行内级项：文字片段、行内块、行内弹性容器。放不下就换行——换行点在文字片段之间，或者在行内块之间。

**行内块收缩到适配。** `inline-block` 的宽度是「内容需要的宽度」，不超过可用宽度。`inline-flex` 同理。

**行内块的推进有一个值得知道的历史坑。** 同一行上有多个行内块时，每个的宽度必须真的加到行游标上。曾经有一版把片段宽度写死成零，游标不前进，后面每个行内块都用同一个 x——全叠在一起。这个错藏了很久，因为既有的测试只放了一个行内块：只有一个的时候，位置取自它前面的文字宽度，看着是对的。

**`text-align`。** `left` / `right` / `center` 生效。`justify` 解析得出来，但结算时和 `left` 走同一个分支——也就是**两端对齐是空操作**。

**空白行。** 整行只有空白且不保留空白时，这个行盒不占高度也不绘制。

## 命中测试

```rust
pub fn hit_test(&self, x: f64, y: f64) -> Option<&LayoutBox>;
pub fn fragment_node_at(&self, x: f64, y: f64) -> Option<NodeId>;
```

两个方向，用途不同。

`hit_test` 走盒子：找包含该点的最深的盒子。它认的是**块级的矩形**。

`fragment_node_at` 走文字片段：按点找到压在该点上的文字片段，返回它的来源节点。

**链接命中必须用后者。** 行内元素在盒子树里没有自己的盒子，所以「找包含该点的最深的盒子，从它往上找 `<a>`」这个办法对任何行内链接都找不到锚点——链接点击整个不灵。反着查才行：文字片段带着来源节点，顺着它往上找祖先就是链接。

## 布局树的平移

```rust
impl LayoutBox {
    pub fn translate(&mut self, dx: f64, dy: f64);
    pub fn translate_to(&mut self, x: f64, y: f64);
}
```

把一棵子树整体移动。看起来是个辅助方法，但它曾经漏掉一样东西：行盒与文字片段的位置存在 `lines` 里，与 `rect`、`content`、`clip` 是分开的字段。只平移前者的话，结果是**框过去了、字还留在原地**。

现象很具体：带内边距或背景的行内元素（`<code>` 这类）被搬到行上之后，文字叠在页面顶部，框里是空的。

平移要覆盖全部位置字段：`rect`、`content`、`clip`，以及全部子盒，以及行盒与它们里面的片段。

## 缩放到适配

`inline-block` 与 `inline-flex` 的宽度计算分两趟：先按「内容需要多宽」量一遍，再用这个宽度做布局。第二趟的结果如果超过了可用宽度，就收缩到可用宽度。

这个做法对内容不太长的元素够用。真正的 shrink-to-fit 要处理「内容宽度依赖可用宽度」的循环，那是表格布局级别的难题。

## 还没做的

| 特性 | 状态 |
| --- | --- |
| `float` | 连字段都没有，全仓零命中 |
| `clear` | 同上 |
| `position: relative` 的偏移 | 字段有，布局不读 |
| `position: absolute` 脱流 | 字段有，布局不读，按常规流处理 |
| `position: fixed` | 同上 |
| `vertical-align` | 字段都没有，行盒基线写死为行高的 0.8 倍 |
| `text-indent` | 行内布局里没有首行缩进入口 |
| `box-sizing` | 未实现 |
| `text-align: justify` | 解析得出来，结算与 left 相同 |

`position` 那一组值得强调：**字段解析进了计算样式，但布局与绘制阶段零读取**。`position: absolute` 的元素会像普通块一样参与常规流，占位置、参与外边距合并。

## 测试

32 条，覆盖盒模型各部分的计算、外边距合并的两种情形、`auto` 外边距的居中与不居中、行盒的构建与折行、行内块收缩到适配、空白行的处理、`min`/`max` 约束、以及 `hit_test` 与 `fragment_node_at` 的边界。
