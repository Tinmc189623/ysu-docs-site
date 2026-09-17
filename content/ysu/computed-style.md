# 计算样式

`ComputedStyle` 是层叠的产物，也是布局的直接输入。763 行，13 条单元测试。

## 字段全集

一个元素最终用到的全部属性，就这些。没有隐藏的、没有在别处另存一份的。

```rust
pub struct ComputedStyle {
    pub display: Display,
    pub position: Position,
    pub top: Size,
    pub right: Size,
    pub bottom: Size,
    pub left: Size,
    pub width: Size,
    pub height: Size,
    pub min_width: Size,
    pub min_height: Size,
    pub max_width: Size,
    pub max_height: Size,
    pub margin: Sides,
    pub border_radius: Radii,
    pub padding: Sides,
    pub border_width: Sides,
    pub border_style: BorderSides,
    pub border_color: Color,
    pub color: Color,
    pub background_color: Color,
    pub font_family: Vec<String>,
    pub font_size: Length,
    pub font_weight: u16,
    pub italic: bool,
    pub line_height: f64,
    pub text_align: TextAlign,
    pub underline: bool,
    pub white_space: WhiteSpace,
    pub flex_direction: FlexDirection,
    pub flex_wrap: FlexWrap,
    pub justify_content: JustifyContent,
    pub align_items: AlignItems,
    pub align_content: AlignContent,
    pub align_self: Option<AlignItems>,
    pub flex_grow: f64,
    pub flex_shrink: f64,
    pub flex_basis: Size,
    pub row_gap: Length,
    pub column_gap: Length,
    pub overflow: Overflow,
    pub opacity: f64,
    pub visibility: bool,
    pub z_index: i32,
}
```

四十三个字段。字段全是 `pub`——它是个数据载体，布局、绘制、渲染都要读，加一层 getter 只添噪音。

**这个列表本身就是一份能力清单。** 列表里没有的属性，无论解析器认不认，都不会生效。

## 值得单独说的几个

### `Size` 而不是 `Length`

宽高与定位那八个字段的类型是 `Size`，不是 `Length`：

```rust
pub enum Size {
    Auto,
    Length(Length),
}
```

因为 `auto` 在宽高上有明确的语义（由布局决定），和 `0` 必须分得开。外边距那四个用 `Sides` 装 `Length`，`auto` 表现为 `LengthUnit::Auto`。

### `line_height` 是 `f64`

行高存的是**倍数**，不是长度。初始值 1.2，`line-height: 1.5` 存 1.5。

这解释了 `line-height: 20px` 为什么不生效——带单位的长度取不出 `f64`，解析那条分支不认，值保持原样。

### `underline` 是布尔

```rust
pub underline: bool,
```

只维护下划线这一种。`overline`、`line-through`、`blink`，以及 `text-decoration` 的颜色、样式、粗细，都没有字段。

这是内核里最常见的「能力受限于字段类型」的例子：想加 `line-through`，先得把这个布尔变成更丰富的类型。

### `border_radius` 是四个角

```rust
pub struct Radii {
    /* 四个角 */
}
```

四个角分开存，**字段顺序按 CSS 写法**（左上、右上、右下、左下），不复用 `Sides` 的上下左右——两者顺序不同，混用会出错。这一点在代码注释里专门写了。

支持百分比，按盒子的**短边**解析。正方形上 `border-radius: 50%` 正好是个圆，非正方形上是个椭圆——这是规范的行为。

只支持单值。`border-radius: 10px 20px` 这种水平/垂直两个值的写法被显式丢弃。见[已知限制](known-limitations.md)。

### `visibility` 是布尔

```rust
pub visibility: bool,
```

`visible` 是真，`hidden` 是假。`collapse` 没有区分。而且 painter 不读它——`visibility: hidden` 现在照样会画出来。

### 解析了但没人读的字段

三个字段现在处于这个状态：

| 字段 | 状态 |
| --- | --- |
| `position` 及其四个 inset | 解析进计算样式，布局与绘制阶段零读取 |
| `z_index` | 解析进计算样式，绘制阶段零读取 |
| `flex_wrap` | 解析进计算样式，布局阶段零读取 |

`Alignment` 那一组里 `align_content` 也是同样的状态。

**在文档口径上这些算「未实现」。** 字段存在只是说明了类型定义是完整的，不构成支持。

## 初始值与继承

```rust
impl ComputedStyle {
    pub fn initial() -> Self;                        // 规范的初始值
    pub fn inherit_from(parent: &ComputedStyle) -> Self;  // 从父样式派生
    pub fn for_root() -> Self;                       // 根元素
}
```

`Default` 走的是 `initial()`。

`inherit_from` 的做法是「先建一份初始值，再把可继承的九项从父元素抄过来」。这样新增字段时默认行为是「不可继承」，需要继承的必须显式加进去——比反过来安全。

## 几个辅助方法

```rust
impl ComputedStyle {
    /// 该元素是否要参与布局。
    pub fn generates_box(&self) -> bool {
        self.display != Display::None
    }

    /// 有效字号，单位换算成像素。
    pub fn font_size_pixels(&self) -> f64;

    /// 边框是否有可见的样式。
    pub fn has_visible_border(&self) -> bool;
}
```

`font_size_pixels` 处理绝对单位的换算（`pt`、`pc`、`in`、`cm`、`mm`），相对单位在层叠阶段已经换算过，这里兜底按 16 像素。

`has_visible_border` 判的是四个边里有没有任意一边的样式是可见的。布局用它决定要不要算边框宽度——样式为 `none` 时即使写了宽度也不占空间。

## 枚举

结构体里用到的枚举都在同一个文件里定义：

```
Display           12 个变体（含五个表格取值）
Position          5 个（static / relative / absolute / fixed / sticky）
Overflow          visible / hidden / scroll / auto
Size              auto / 长度
FlexDirection     4 个
FlexWrap          2 个
JustifyContent    6 个
AlignItems        5 个
AlignContent      7 个
TextAlign         4 个
WhiteSpace        5 个
BorderStyle       若干
```

`Display` 的 12 个变体值得列一下：

```rust
pub enum Display {
    None, Block, Inline, InlineBlock, Flex, InlineFlex,
    ListItem, Table, TableRowGroup, TableRow, TableCell, TableCaption,
}
```

`grid`、`inline-grid`、`flow-root`、`contents`、`table-column` 都不在其中。`inline-table` 会被**降级成 `Display::Table`**——这一条在 `cascade.rs` 里做了显式处理。

## 测试

13 条，覆盖初始值的完整性、继承链的九项、`auto` 与零的区分、百分比半径的短边解析、以及几个辅助方法的边界。
