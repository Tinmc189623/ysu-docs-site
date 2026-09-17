---
title: "树构建"
description: "把记号流组织成一棵 DOM 树。这一层是内核里最复杂的部分——WHATWG 规范里插入模式、格式化元素、表格寄养、收养机构这几节加起来有上百页，实现下来两千八百行。"
---

把记号流组织成一棵 DOM 树。这一层是内核里最复杂的部分——WHATWG 规范里插入模式、格式化元素、表格寄养、收养机构这几节加起来有上百页，实现下来两千八百行。

## 入口

```rust
pub struct TreeBuilder<'a> { /* ... */ }

impl<'a> TreeBuilder<'a> {
    pub fn new(input: &'a str) -> Self;
    pub fn new_fragment(input: &'a str, context_name: &str, namespace: Namespace) -> Self;
    pub fn parse(mut self) -> Document;
    pub fn is_quirks_mode(&self) -> bool;
}
```

便利函数：

```rust
pub fn parse_document(input: &str) -> Document;
pub fn parse_fragment(input: &str, context_name: &str, namespace: Namespace) -> Document;
```

## 十九个插入模式

树构建是个状态机。当前模式决定一个记号该怎么处理——同样是 `<td>`，在 `tr` 里面和在段落里面含义完全不同。

```rust
enum InsertionMode {
    Initial,          // 处理最开始的 DOCTYPE 与注释
    BeforeHtml,       // 建立 html 之前
    BeforeHead,       // 建立 head 之前
    InHead,           // head 内部
    AfterHead,        // head 结束、body 开始之前
    InBody,           // body 内部，绝大部分内容在这里
    Text,             // 原始文本元素内部
    InTable,          // 表格内部
    InTableText,      // 表格里的非表格文本，攒起来判定
    InCaption,        // caption 内部
    InColumnGroup,    // colgroup 内部
    InTableBody,      // tbody / thead / tfoot 内部
    InRow,            // tr 内部
    InCell,           // td / th 内部
    InSelect,         // select 内部
    InSelectInTable,  // select 里出现了表格标签
    AfterBody,        // body 结束之后
    AfterAfterBody,   // 整个文档结束之后
}
```

`Text` 模式是词法层交给它的：进 `<script>` 或 `<title>` 时切模式，出结束标签时切回来。

## 活动格式化元素表

`<b>1<p>2</b>3</p>` 这类输入里，标签是交错闭合的。规范要求把它们修成正确嵌套的树，修的过程要用到一张「活动格式化元素表」：

```rust
enum FormattingEntry {
    Marker,                                    // 作用域分界标记
    Element { id: NodeId, name: String, attributes: Vec<Attribute> },
}
```

`Marker` 是分界：表格单元格会插入一个标记，之后重建格式化元素时不会跨过它。这条规则挡的是「表格外面的 `<b>` 被重建到表格里面」这类错。

`Element` 里存着建立时的属性，因为重建时要照着再建一个一模一样的。

**收养机构算法**是处理交错闭合的那段。它复杂到规范单独给它起了一个名字，处理的是「格式化元素的结束标签出现时，它在栈里的位置与当前节点之间的那一段怎么办」。

## 表格的寄养

在表格上下文里遇到不该出现在表格中的元素时（比如 `<table><div>x</div></table>`），规范要求把 `div` 插到表格**前面**，而不是里面。这个行为叫寄养。

```rust
struct PendingTableText {
    has_non_whitespace: bool,
    text: String,
}
```

表格里的文本还要单独攒一层。`InTableText` 模式先把连续文本收进 `PendingTableText`，等看清里面有没有非空白字符再决定：全是空白就当没事，有内容就触发寄养。

## 外来内容

SVG 与 MathML 的子树的处理规则：

```rust
// crates/ysu/src/html/foreign.rs
pub fn adjust_svg_tag_name(name: &str) -> &str;
pub fn adjust_svg_attributes(attributes: &mut [Attribute]);
pub fn adjust_mathml_attributes(attributes: &mut [Attribute]);
pub fn breaks_out(name: &str, attributes: &[Attribute]) -> bool;
pub fn breaks_out_end_tag(name: &str) -> bool;
```

**标签名调整。** HTML 源码里的 `foreignobject` 要变成 `foreignObject`——SVG 的元素名是驼峰式的，但 HTML 词法会把属性名和标签名都转成小写。

**属性调整。** `attributename` 变成 `attributeName`，`viewbox` 变成 `viewBox`，`gradienttransform` 变成 `gradientTransform`，等等。SVG 与 MathML 各有各的对照表。

**跳出外来内容。** 在 SVG 子树里遇到一个 HTML 标签（`<p>`、`<div>` 这类），要跳出 SVG 回到 HTML 内容。`breaks_out` 判的就是这件事。有一条例外：`<font>` 只有在带着 `color`、`face`、`size` 属性之一时才跳出，不带就是 SVG 的 `font` 元素。

## 怪异模式

```rust
pub fn is_quirks_mode(&self) -> bool;
```

缺少 DOCTYPE、或者 DOCTYPE 写坏了时，文档进入怪异模式。规范里这个模式改变一堆东西的行为；在内核里它现在被记录下来备查。

## 片段解析

```rust
pub fn parse_fragment(input: &str, context_name: &str, namespace: Namespace) -> Document;
```

片段解析与整篇解析的区别只在开头：没有 `html` / `head` / `body` 那一套，起始插入模式由上下文元素决定，内容全部挂在一个新建的 `html` 元素下面。产物里那个 `html` 元素的子节点就是片段的内容——这是规范定的形状。

上下文元素决定两件事：起始插入模式，以及记号该怎么切。上下文是 `table` 时，一段 `<tr>` 才不会被当成无主的行丢掉；上下文是 `title` 时，内容按 RCDATA 读。

这个入口的用途是 `innerHTML` 那类场景。**它还没有接到公开的 DOM 接口上**，也没有纳入 html5lib 的片段用例比对。

## 验证

html5lib 的树构建用例是这一层唯一的规模化验证：`tree-construction/` 下 57 个文件、1709 条用例，涵盖规范里几乎所有分支。

```bash
cargo test -p ysu --test html5lib_tree
```

带 `#document-fragment` 的 192 条现在单列成「尚未支持」，不参与断言。判据详见[测试](../contributing/testing.md)。

## 单元测试

36 条，覆盖的是那些用一条用例就能说清楚的规则：隐式闭合（`<p>` 遇到块级元素自动闭合）、`<form>` 的嵌套禁止、表格结构与寄养、外来内容的标签名调整、怪异模式的判定。

## 两千八百行的代价

这一层的代码量在整个内核里排第二（第一是布局）。它长的原因是规范本身就长——插入模式有十九个，每个模式下每种记号都要有分支，加起来就是几百个分支。

想读它的话，从 `process_token` 那个总入口进去，看它怎么按当前模式分派，然后挑一个模式（`InBody` 最有代表性）看下去。
