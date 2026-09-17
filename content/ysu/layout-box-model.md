# 盒模型与布局树

DOM 树加上计算样式，变成一棵带尺寸与位置的盒子树。这一步是布局阶段的输入准备工作。

## 盒子类型

```rust
pub enum BoxKind {
    Block,
    Inline,
    InlineBlock,      // 对外行内级，对内块容器
    Flex,
    ListItem,         // 会额外画一个标记
    Text(Box<str>),   // 装的是已按空白规则处理过的内容
    AnonymousBlock,   // 包住块容器里的行内级内容
    Table,
    TableRowGroup,
    TableRow,
    TableCell,
    TableCaption,
}
```

与 `Display` 的取值一一对应，多出来的是 `AnonymousBlock`。

`Text` 变体装的是 `Box<str>` 而不是 `String`——它一旦建好就不再改，没有扩容的需求，省下 8 字节的容量字段。

## 匿名块盒

块容器（`Block`、`ListItem`、`Flex`）里混着行内内容时，规范要求把连续的行内内容包进一个**没有对应元素**的块盒：

```html
<div>
  一些文字
  <span>行内元素</span>
</div>
```

`div` 是块容器，里面的文字与 `span` 都是行内级，于是被包进一个匿名块盒。这个盒子在 DOM 里没有对应节点，在样式上继承 `div` 的。

有一条例外：**Flex 容器不做匿名包装**。弹性布局的子项直接就是子项，`display: flex` 会块化（blockify）它的子元素——把行内子项当成 `inline-block` 处理，而不是包一层匿名块。

## 空白处理

```rust
pub fn process_text(/* ... */) -> /* ... */;
```

文本在进盒子树之前先过一遍空白规则，判据是 `white-space`：

| 值 | 连续空白 | 换行符 | 自动折行 |
| --- | --- | --- | --- |
| `normal` | 折叠成一个空格 | 当空格 | 会 |
| `nowrap` | 折叠 | 当空格 | 不会 |
| `pre` | 保留 | 保留 | 不会 |
| `pre-wrap` | 保留 | 保留 | 会 |
| `pre-line` | 折叠 | 保留 | 会 |

「折叠」包括去掉行首行尾的空白。这一步在盒子树阶段做掉，布局阶段拿到的就是干净的文本。

## 文本片段

行里的每一段文字是一个 `TextFragment`：

```rust
pub struct TextFragment {
    pub text: String,
    pub color: Color,
    pub font: TextStyle,
    pub underline: bool,
    /// 该片段是否保留空白。
    pub preserve_whitespace: bool,
    /// 这段文字来自哪个节点。
    pub node: Option<NodeId>,
}
```

`preserve_whitespace` 控制一件事：不保留时，整行只有空白的行盒不占高度也不参与绘制。这就是 HTML 里元素之间的换行与缩进不会撑开页面的原因。

```html
<div>
  <p>a</p>
  <p>b</p>
</div>
```

这段 HTML 里 `</p>` 与 `<p>` 之间有一个换行和一个缩进，它们构成一个纯空白行。不处理的话两个段落之间会多出将近一行的高度。

`node` 字段是命中测试的入口。行内元素在盒子树里**没有自己的盒子**——文字被折进所在块的行里——所以想从坐标反查「这一点压在哪个链接上」，只能沿着文字片段的来源节点往上找祖先。

## 几何

```rust
pub struct Point { /* f64 */ }
pub struct Size { /* f64 */ }
pub struct Rect { /* f64 */ }
pub struct Edges { /* f64，四边 */ }
```

全部是 `f64`，坐标**一律相对页面左上角，单位是逻辑像素**。布局层里不出现像素比这个概念——那是渲染层的事。

`Rect::contains` 是**半开区间**：右边界与下边界上的点不算在矩形内。这样相邻的两个元素不会对边界上的同一个点同时命中，命中测试因此不需要处理「取哪个」的问题。

## 布局上下文

```rust
pub struct LayoutContext {
    pub viewport_width: f64,
    pub viewport_height: f64,
    pub root_font_size: f64,
}
```

默认 1280×800，根字号 16。`vw` / `vh` / `vmin` / `vmax` 与 `rem` 从这三个值算。

## 长度换算

```rust
pub fn resolve_length(&self, length: Length, containing: f64, font_size: f64) -> f64;
```

| 单位 | 换算 |
| --- | --- |
| `px` / 无单位零 | 原值 |
| `%` | `value / 100 * containing` |
| `em` | `× font_size` |
| `rem` | `× root_font_size` |
| `vw` / `vh` | `value / 100 ×` 视口宽/高 |
| `vmin` / `vmax` | 视口宽高的较小/较大者 |
| `ch` / `ex` | `× font_size × 0.5` |
| 绝对单位 | 按解析阶段的换算表 |

**`ch` 与 `ex` 是近似的。** 代码注释里写了原因：没有真实字体度量可用，`0.5em` 是个常见的近似值。要算准得问整形器要字体的实际参数。

`containing` 的含义取决于是哪个属性：宽高与内边距用包含块的宽度，纵向的外边距也用宽度（规范如此），行高用元素自己的字号。

## 相对单位在哪儿换算

分两处：

**字号相关的（`em`、`%` 的字号）在层叠阶段**。元素的字号要先定下来，`em` 才有基准。

**其余在布局阶段**。宽高的百分比要知道包含块宽度，`vw` 要知道视口，这些信息只有在布局时才有。

## 一个容易搞错的地方

`margin: 0 auto` 与 `margin: 0` 在「解析成像素」之后都是零。区别靠 `LengthUnit::Auto`——布局只在明确写了 `auto` 的那一边吃剩余空间。

如果判据写成「左右外边距都是零就居中」，那么每一个「有明确宽度、外边距为零」的块都会被错误地居中——`#d { width: 200px }` 在 800 宽的视口里会跑到 x=300 而不是靠左。真实的网页上凡是定宽容器、卡片、右对齐的按钮，位置全错。

这条在 `Length::is_auto()` 里体现，`is_zero()` 不把 `auto` 当成零。
