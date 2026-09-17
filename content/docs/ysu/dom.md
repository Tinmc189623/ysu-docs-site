---
title: "DOM"
description: "内核里的文档树。用一个 arena 而不是指针树，这一条决定了它用起来的样子。"
---

内核里的文档树。用一个 arena 而不是指针树，这一条决定了它用起来的样子。

## 为什么用 arena

```rust
//! 文档对象模型。
//!
//! 节点存在一张表里，彼此之间用 [`NodeId`] 互相引用而不是指针。这样树里
//! 不会出现引用计数成环，样式表与布局表也都能直接拿 `NodeId` 当键。
```

三个好处，都是实际的：

**不会成环。** DOM 里父子互指是常规操作，用 `Rc<RefCell<>>` 的话每一对父子都是一个环，引用计数永远归不了零。用编号就不存在这个问题——编号是数字，不是所有权。

**可以直接当键。** 样式表是 `HashMap<NodeId, ComputedStyle>`，布局树里也存 `NodeId`。用指针的话得先分配一个稳定的地址，或者套一层 id。

**借用检查好过。** 想同时读父节点和子节点，在 arena 里就是两次 `document.node(id)`，不涉及可变借用的冲突。

代价是删节点要手动维护索引，以及节点编号不能跨文档使用。

## 节点

```rust
pub struct NodeId(pub usize);

pub enum Namespace { Html, Svg, MathMl }

pub enum NodeData {
    /* 元素、文本、注释、文档 */
}
```

`Namespace` 是必须的——SVG 与 MathML 的元素名调整、属性调整、跳出规则都要看它。

每个节点提供一组判定与取值：

```rust
impl Node {
    pub fn as_element(&self) -> Option<&Element>;
    pub fn as_element_mut(&mut self) -> Option<&mut Element>;
    pub fn as_text(&self) -> Option<&str>;
    pub fn as_comment(&self) -> Option<&str>;
    pub fn tag_name(&self) -> Option<&str>;
    pub fn is_element(&self, name: &str) -> bool;
    pub fn has_attribute(&self, name: &str) -> bool;
}
```

## 元素与属性

```rust
impl Element {
    pub fn new(name: impl Into<String>) -> Self;
    pub fn get_attribute(&self, name: &str) -> Option<&str>;
    pub fn set_attribute(&mut self, name: &str, value: &str);
    pub fn remove_attribute(&mut self, name: &str);
    pub fn has_attribute(&self, name: &str) -> bool;
    pub fn has_token(&self, name: &str, token: &str) -> bool;
    pub fn id(&self) -> Option<&str>;
    pub fn tokens(&self, name: &str) -> Vec<&str>;
    pub fn is_html(&self, name: &str) -> bool;
}
```

两个方法值得单独说：

**`has_token`。** 属性值是空格分隔的词表时用它判成员。`class="note wide"` 用 `has_token("class", "note")` 判，而不是 `get_attribute("class") == Some("note")`——后者对多类名会漏。选择器匹配里的 `.note` 就是靠它。

元素上不存一份单独的 class 集合。分开存要维护同步，而且 `class` 属性是可以被 `set_attribute` 直接改的。

**`is_html`** 判断元素名在 HTML 命名空间下的匹配。外来内容里的同名元素要区别对待。

## 文档

```rust
impl Document {
    pub fn new() -> Self;
    pub fn root(&self) -> NodeId;
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;

    pub fn node(&self, id: NodeId) -> &Node;
    pub fn node_mut(&mut self, id: NodeId) -> &mut Node;
    pub fn element(&self, id: NodeId) -> Option<&Element>;
    pub fn element_mut(&mut self, id: NodeId) -> Option<&mut Element>;

    pub fn create(&mut self, data: NodeData) -> NodeId;
    pub fn create_element(&mut self, element: Element) -> NodeId;
    pub fn create_text(&mut self, text: impl Into<String>) -> NodeId;
    pub fn create_comment(&mut self, text: impl Into<String>) -> NodeId;

    pub fn append_child(&mut self, parent: NodeId, child: NodeId);
    pub fn insert_before(&mut self, parent: NodeId, child: NodeId, reference: NodeId);
    pub fn detach(&mut self, child: NodeId);
    pub fn reparent_children(&mut self, from: NodeId, to: NodeId);
}
```

`reparent_children` 是给收养机构算法用的——把一个节点的全部子节点搬到另一个节点下面。

## 遍历

```rust
impl Document {
    pub fn parent(&self, id: NodeId) -> Option<NodeId>;
    pub fn children(&self, id: NodeId) -> &[NodeId];
    pub fn child(&self, id: NodeId, index: usize) -> Option<NodeId>;
    pub fn last_child(&self, id: NodeId) -> Option<NodeId>;
    pub fn next_sibling(&self, id: NodeId) -> Option<NodeId>;
    pub fn previous_sibling(&self, id: NodeId) -> Option<NodeId>;
    pub fn first_element_child(&self, id: NodeId) -> Option<NodeId>;
    pub fn last_element_child(&self, id: NodeId) -> Option<NodeId>;

    pub fn descendants(&self, root: NodeId) -> Vec<NodeId>;
    pub fn descendants_of_kind(&self, root: NodeId, name: &str) -> Vec<NodeId>;
}
```

`children` 返回切片，`descendants` 返回 `Vec`。前者是零成本的，后者要分配——遍历热路径上用前者的那组。

注意「元素子节点」与「子节点」是分开的：`first_element_child` 会跳过文本节点，`child` 不会。DOM 里这两者在写代码时特别容易混，`<div>\n  <p>x</p>\n</div>` 的 `firstChild` 是一个换行文本节点。

## 查询

```rust
impl Document {
    pub fn find_element(&self, /* ... */) -> Option<NodeId>;
    pub fn find_elements(&self, root: NodeId, predicate: impl Fn(&Element) -> bool) -> Vec<NodeId>;
    pub fn text_content(&self, node: NodeId) -> String;
    pub fn title(&self) -> Option<String>;
}
```

**没有 `querySelector`。** `find_elements` 接受一个谓词闭包，调用方自己写判定条件。这是有意的取舍：选择器匹配需要 `ElementState`（hover、visited 这些）和文档上下文，把它挂在 `Document` 上会让这两层耦合起来。

现在需要按选择器找元素的地方是样式层——`cascade.rs` 遍历整棵树，对每个元素跑一遍选择器匹配。它不需要 `querySelector` 这个接口。

`title()` 是从文档里取 `<title>` 的内容，外壳用它设窗口标题。

## 文本内容

```rust
pub fn text_content(&self, node: NodeId) -> String;
```

按文档顺序把子树里所有文本节点拼起来。注释不算，元素之间的空白算。

## 测试

14 条，覆盖创建、插入、移动、遍历的各个方向，以及 `text_content` 的拼接顺序。

树构建的 1709 条 html5lib 用例间接覆盖了 DOM 的构造路径——那些用例断言的就是树的形状，比对靠的是按 html5lib 格式把 DOM 打印成文本。
