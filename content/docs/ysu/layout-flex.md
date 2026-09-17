---
title: "弹性布局"
description: "单行的 flex 布局。flex-direction 的两个轴向、justify-content 六种取值、align-items 与 align-self 都有。"
---

单行的 flex 布局。`flex-direction` 的两个轴向、`justify-content` 六种取值、`align-items` 与 `align-self` 都有。

## 属性

```rust
pub enum FlexDirection {
    Row, RowReverse,
    Column, ColumnReverse,
}

pub enum JustifyContent {
    FlexStart, FlexEnd, Center,
    SpaceBetween, SpaceAround, SpaceEvenly,
}

pub enum AlignItems {
    Stretch, FlexStart, FlexEnd, Center, Baseline,
}
```

对应的 `ComputedStyle` 字段：`flex_direction`、`flex_wrap`、`justify_content`、`align_items`、`align_content`、`align_self`、`flex_grow`、`flex_shrink`、`flex_basis`、`row_gap`、`column_gap`。

## 主轴与侧轴

`flex-direction` 决定哪个方向是主轴。`Row` 与 `Column` 都能用；`RowReverse` 与 `ColumnReverse` **解析得出来但不生效**——布局只看 `is_row()`，反向排布的那条路径没有实现。

`is_reversed()` 这个辅助方法在 `computed.rs` 里定义了，但没有任何调用点。

## 主轴的尺寸分配

逐个处理每个子项：

1. **基准尺寸。** `flex-basis` 不是 `auto` 就用它；是 `auto` 就用子项的 `width`（行方向）或 `height`（列方向）；都没有就用内容宽度。

2. **伸展。** 所有基准尺寸之和小于容器时，剩余空间按 `flex-grow` 的比例分配。

3. **收缩。** 超过容器时，超出部分按 `flex-shrink × 基准尺寸` 的加权比例扣减。

4. **`justify-content`。** 分配完之后如果还有剩余，按它排布：

| 取值 | 剩余空间 |
| --- | --- |
| `flex-start` | 全放末尾 |
| `flex-end` | 全放开头 |
| `center` | 两边平分 |
| `space-between` | 只在项与项之间平分 |
| `space-around` | 每项两边各半份 |
| `space-evenly` | 所有间隔等分 |

## 侧轴的对齐

`align-items` 决定子项在侧轴上的位置：

- `stretch`（初始值）：子项没有指定侧轴尺寸时拉满
- `flex-start` / `flex-end` / `center`：按内容尺寸放在开头、末尾、中间
- `baseline`：**按 flex-start 处理**。基线对齐需要先算出所有子项的基线，再取最高的那个对齐，这条路径没有实现

`align-self` 覆盖容器的 `align-items`，支持。

## 只支持单行

```rust
pub flex_wrap: FlexWrap,
```

`flex-wrap` 解析进计算样式，但**布局阶段零读取**。所以永远是单行：

- `flex-wrap: wrap` 不生效，子项不会折到下一行
- 子项太多时会被压缩（因为 `flex-shrink` 默认为 1），而不是换行
- `align-content` 同样零读取——它管的是多行之间的对齐，没有多行自然用不上

这是弹性布局里最明显的一个能力边界。用 `flex-wrap` 做的响应式卡片墙、标签云现在都会挤成一行。

## 列方向的额外限制

行方向（`row`）的主轴尺寸由容器宽度定，一般都有确定值，所以 `justify-content` 的六种取值都能算出来。

列方向（`column`）不一样：容器高度往往由内容决定（`height: auto`），主轴是「内容需要多高」而不是「容器有多高」。这种情况下没有剩余空间可分配，`justify-content` 落空。

即使容器高度确定，列方向的 `space-between` / `space-around` / `space-evenly` 也一律按居中处理。这条路径没有分开实现。

## 间距

`row-gap`、`column-gap` 与 `gap` 简写都支持。间距在计算剩余空间时先扣掉。

## 行内弹性容器

`display: inline-flex` 支持：对外表现为行内级（跟文字排在同一行上），对内是弹性容器，宽度收缩到适配。

## 一个例子

```html
<div style="display: flex; justify-content: space-between; align-items: center">
  <span>左</span>
  <span>右</span>
</div>
```

外层是弹性容器，主轴是行方向。`space-between` 把两个 `span` 分别推到两端，`align-items: center` 让它们在纵向居中。

这类「两端对齐 + 垂直居中」是 flex 最常见的用法，现在能正常工作。

## 还没做的

| 特性 | 状态 |
| --- | --- |
| `flex-wrap` | 字段有，布局不读 |
| `align-content` | 字段有，布局不读 |
| `order` | 字段都没有 |
| `flex-direction: *-reverse` | 解析得出来，不生效 |
| `align-items: baseline` | 按 flex-start 处理 |
| 列方向的 `justify-content` 剩余空间分配 | 只在容器高度确定时可用，且三号 space-* 按居中处理 |

## 测试

弹性布局的测试在内核里混在 `layout/engine.rs` 的 32 条里，覆盖基准尺寸的三种来源、伸展与收缩的分配比例、六种 `justify-content`、四种 `align-items`、`align-self` 的覆盖、间距的计算，以及行内弹性容器的收缩到适配。
