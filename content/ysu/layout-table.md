# 表格布局

最小可用的表格。列宽按内容求解，行高取该行最高单元格。行列是齐的，边框合并与跨行跨列没有。

## 显示类型

表格相关的 `Display` 取值有五个：

```rust
Table, TableRowGroup, TableRow, TableCell, TableCaption
```

`border-collapse`、`border-spacing`、`caption-side` 这些声明会被解析，但目前没有消费方。

## 盒子类型

`BoxKind` 里有对应的五种：`Table`、`TableRowGroup`、`TableRow`、`TableCell`、`TableCaption`。

行由 `row_paths` 收集，只认两级结构：

```
TableRow
TableRowGroup > TableRow
```

也就是 `<table><tr>` 与 `<table><tbody><tr>` 都行。隐含的 `tbody` 由树构建阶段补出来。更深的嵌套（`<table><tbody><tr><td><table>` 里的内层表是另一棵独立的表）能成立，但同一个表里的行不会跨越多层。

## 列宽求解

```rust
fn column_widths(/* ... */) -> /* ... */;
```

算法是：

1. 列数由一行里最多的单元格个数决定
2. 每列的宽度取该列所有单元格的**固有宽度**里的最大值
3. 所有列宽之和超过表格可用宽度时，按比例压缩

固有宽度是「这一段内容不折行时需要多宽」。它由文本整形器量出来。

**单元格按它在行里的下标对列。** 这在没有 `colspan` 的情况下是对的。

**指定的列宽不参与求解。** `layout_table` 把算好的列宽反推写进每个单元格的 `forced_width`，而 `layout_block` 优先用它——所以单元格上写的 CSS `width` 会被覆盖。

## 行高

每行的高度取该行最高的单元格。行与行之间互不影响，没有「同一行的所有单元格等高」之外的约束。

## 单元格

单元格内部的布局走的是普通的块级布局。`vertical-align` 没有实现，所以 `valign` 系列的垂直居中做不到。

`padding` 有效——内置样式表给 `td, th` 写了 `padding: 1px`。

## 表格标题

```html
<table>
  <caption>表标题</caption>
  <tr><td>a</td></tr>
</table>
```

**`caption` 现在整段不可见。**

原因链是：`TableCaption` 只有脱离 table 时才走 `layout_block`；`layout_table` 只经 `row_paths` 取行，不取标题；标题的盒子停在默认矩形（零位置零尺寸），文字没有行盒，绘制阶段走空行分支。

内置样式表给了 `caption { display: table-caption; text-align: center }`，解析是对的，布局没接。

## 表格的边框

`<table border=1>` 画不出格线，`style="border:1px solid"` 也只能画出外框。

缺的是「外框 + 每格线」的绘制模型。这个模型要先有 `border-spacing` 与 `border-collapse` 才立得起来——分离模型下格线是每格自己的边框，合并模型下相邻边框要二选一。

内置样式表里 `table { border-collapse: separate; border-spacing: 2px }` 与 `td, th { padding: 1px }` 都在，但前两条没有消费方。

## 一个有代表性的设置

```html
<table>
  <tr><th>名称</th><th>数量</th></tr>
  <tr><td>苹果</td><td>3</td></tr>
</table>
```

这个能正常渲染：两列，列宽按内容分配，`th` 加粗居中（内置样式表给的），行列对齐。

加上 `width: 100%` 的表格会把列宽按比例撑开。

## 还没做的

| 特性 | 状态 |
| --- | --- |
| `colspan` | 全仓零命中 |
| `rowspan` | 全仓零命中 |
| 表格栅格模型 | 没有，列数靠「一行里最多几个单元格」推 |
| `border-collapse` | 解析了，不生效 |
| `border-spacing` | 解析了，不生效 |
| `table-layout: fixed` | 未实现，列宽一律内容驱动 |
| `caption` 的摆放与 `caption-side` | 盒子建出来了，布局不处理，标题不可见 |
| `empty-cells` | 未实现 |
| `<table border=1>` 的呈现属性映射 | 未实现 |
| `vertical-align`（`valign` 依赖它） | 未实现 |

**跨行跨列的缺失在真实页面上很显眼。** 一个用了 `colspan` 的表头会让整行的单元格都左移，后面的列全部错位。用表格做版式的老页面也会因此散架。

## 一个已知的取舍

表格布局里最麻烦的是 `table-layout: auto` 的完整列宽约束求解——它要考虑每列的最小内容宽度、最大内容宽度、百分比宽度、跨列单元格的约束，然后解一组约束。规范给出的算法有十几步。

现在用的是简化版：取最大固有宽度，放不下按比例压缩。结果是**表格会偏紧或偏宽，但行列是齐的**。对内容宽度接近的列（大多数数据表格）效果可以；对宽度悬殊的列（一列长文本、一列短数字）会挤得不好看。

## 测试

表格相关的测试在 `layout/engine.rs` 的 32 条里，包括一条 `caption_is_placed_inside_table`。覆盖列宽求解、行高、隐含 `tbody` 与直接 `tr` 两种写法、以及表格与周围内容的相互影响。
