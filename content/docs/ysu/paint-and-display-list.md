---
title: "绘制与显示列表"
description: "把盒子树翻译成一串平台无关的绘制命令。这一步之后，只剩下渲染器把命令变成 draw call。"
---

把盒子树翻译成一串平台无关的绘制命令。这一步之后，只剩下渲染器把命令变成 draw call。

## 六种命令

```rust
pub enum DrawCommand {
    FillRect { rect: Rect, color: Color, corners: Corners },
    Border   { rect: Rect, widths: Edges, color: Color, style: LineStyle, corners: Corners },
    Text     { rect: Rect, baseline: f64, text: String, color: Color, font: TextStyle, underline: bool },
    Image    { rect: Rect, source: String },
    PushClip { rect: Rect },
    PopClip,
}
```

配套的类型：

```rust
pub struct Corners { pub top_left: f64, pub top_right: f64, pub bottom_right: f64, pub bottom_left: f64 }

pub enum LineStyle { Solid, Dashed, Dotted, Double }

pub struct DisplayList {
    pub commands: Vec<DrawCommand>,
    pub viewport_width: f64,
    pub viewport_height: f64,
}
```

**命令里的数据全是自有的。** `Text` 命令装的是 `String` 而不是切片，`Border` 装的是值而不是引用。代价是每帧多做几次分配；收益是 `DisplayList` 可以被构造、被比较、被单元测试、被写进调试输出——不绑在任何一棵树的生存期上。

**`Corners` 的字段顺序是左上、右上、右下、左下**，与 `Radii` 一致，与 `Edges` 的上下左右不同。

## `Image` 是死代码

```rust
Image { rect: Rect, source: String },
```

这个变体定义了，`summary` 会数它，`translate` 会平移它，渲染器里有一个显式的空分支——**但没有任何地方生产它**。

Painter 不生成图片命令，因为从 HTML 解析到固有尺寸、解码、纹理上传、子资源加载这五环全是空的。`<img>` 元素在盒子树里不产生替换内容。

出现方式也不对：`<img>` 在 HTML 里是行内元素，现在按内置样式表的 `img { display: inline-block }` 走，但因为固有尺寸算不出来，宽度是零。所以图片既不显示也不占位。

## 绘制顺序

对每个盒子：背景 → 边框 → 内容。

内容分几种：文字片段、列表标记、子盒子。

**先序推命令。** 遍历盒子树，父盒子的命令先于子盒子。这是最简单也最正确的默认顺序——它对应 CSS 里「后出现的元素盖在先出现的上面」这条基本规则。

**`opacity` 累乘。** 从祖先一路乘下来，每个盒子自己的不透明度与祖先的相乘。这近似了 CSS 的透明组语义，与「建立独立合成层再整体调透明」有区别：重叠的子元素在两边会看出差异。

**`z-index` 与层叠上下文没有实现。** 定位元素建立层叠上下文、按 z-index 排序输出的那套流程不存在，所以绝对定位元素的上下关系只能靠文档顺序。

## 裁剪

```rust
PushClip { rect: Rect },
PopClip,
```

`overflow` 是 `hidden`、`scroll`、`auto` 之一时推一个裁剪矩形，子树画完弹掉。三种取值走同一条路径——**没有滚动条**，`scroll` 与 `auto` 只是裁掉溢出内容。

裁剪矩形是轴对齐的。`clip-path` 与 `mask` 没有实现，`shape-outside` 也没有。

## 剔除

```rust
pub fn paint_tree(tree: &LayoutTree) -> DisplayList;
pub fn paint_tree_region(tree: &LayoutTree, visible: Rect) -> DisplayList;
```

`paint_tree_region` 是滚动时用的：只生成落在可见范围内的命令。滚动一屏不需要把整页几百条命令重新算一遍。

剔除分两级：盒子本身超出可见范围就整棵跳过，文字片段单独判一次。后者是必要的——一个大段落盒子里可能只有几行看得见，整盒剔除会让页面出现空白。

## 圆角边框的画法

```rust
fn paint_rounded_border(/* ... */);
```

圆角边框没有走「按圆角把边框分段」那条路，而是用一个等价画法：**先用边框色填满整个边框盒，再用背景色填满内边距盒、半径按边框宽度收窄**。两步叠出来就是一圈带圆角的边。

这个做法简单得多，代价是它只对「**四边等宽、实线、背景不透明**」成立。其余情况退回方角路径。

四边样式不一致时，取第一个可见的样式作为整圈的样式（`dominant_border_style`）。

## 列表标记

```rust
fn paint_list_marker(/* ... */);
```

`display: list-item` 的元素前面画一个标记。**现在一律画实心圆点 `•`。**

`list-style-type` 没有实现——内置样式表里的 `ol { list-style-type: decimal }` 是一条被丢掉的声明。所以有序列表画出来也是圆点。

要出编号得先有计数器，计数器要依赖生成内容（`::before` / `::after` 与 `content`），那整条链都不存在。

## 边框的分边

```rust
pub fn border_rects(rect: Rect, widths: Edges) -> [Rect; 4];
```

把一个边框盒拆成四条边的矩形。渲染器用它逐边画线，因为四边的样式可能不同。

## 一个例子

```rust
let display_list = paint_tree_region(&layout_tree, visible);
println!("{}", display_list.summary());
```

`DisplayList` 上有一组辅助方法：`new`、`push`、`len`、`is_empty`、`summary`、`text_contents`、`all_text`、`translate`、`clip_to`、`append`。

`summary()` 打一份按类型统计的摘要，`all_text()` 把全部文字拼起来。

`clip_to` 是给外壳把页面裁到工具栏以下用的，`translate` 是整体平移。

## 测试

20 条，覆盖命令的生成顺序、圆角半径的解析（含百分比按短边算）、裁剪的推入弹出配对、剔除的边界、边框分拆、以及 `DisplayList` 上那些辅助方法的正确性。
