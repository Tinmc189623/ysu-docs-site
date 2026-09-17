---
title: "选择器"
description: "匹配、组合器、优先级。1561 行，29 条单元测试。"
---

匹配、组合器、优先级。1561 行，29 条单元测试。

## 结构

三层嵌套：

```rust
pub struct ComplexSelector {          // div > .note:first-child
    pub compounds: Vec<CompoundSelector>,
    pub combinators: Vec<Combinator>,
}

pub struct CompoundSelector {         // .note:first-child
    pub type_selector: Option<TypeSelector>,
    pub id: Option<String>,
    pub classes: Vec<String>,
    pub attributes: Vec<AttributeSelector>,
    pub pseudo_classes: Vec<PseudoClass>,
    pub pseudo_element: Option<String>,
}
```

`compounds` 与 `combinators` 的长度关系是固定的：前者的长度恒等于后者加一。`div > p span` 是三个复合选择器夹两个组合器。

## 组合器

```rust
pub enum Combinator {
    Descendant,          // 空格
    Child,               // >
    NextSibling,         // +
    SubsequentSibling,   // ~
}
```

四种，都是 CSS 2.1 就有的。

匹配是**从右往左**做的：

```rust
pub fn matches(
    selector: &ComplexSelector,
    document: &Document,
    element: NodeId,
    state: &ElementState,
) -> bool;
```

先从最右那个复合选择器匹配当前元素，通过了再按组合器往左找祖先或兄弟。这个方向是有讲究的：从右往左时，第一个条件就能筛掉绝大多数元素，剩下的才需要往树上走。反过来做的话每个元素都要先找出所有后代。

`Combinator::Descendant` 是唯一需要遍历多个候选的——它往上逐个试祖先，任何一个匹配就成立。其余三种都只有一个候选。

## 类型与属性

```rust
pub enum TypeSelector {
    Universal,       // *
    Name(String),    // 标签名，已转小写
}

pub enum AttributeOperator {
    Exists,          // [href]
    Equals,          // [href="x"]
    Includes,        // [class~="x"]
    DashMatch,       // [lang|="en"]
    Prefix,          // [href^="https"]
    Suffix,          // [href$=".pdf"]
    Substring,       // [href*="example"]
}
```

`Includes`（`~=`）按空格分隔的词表判成员，走的是 `Element::has_token`。

属性选择器带一个大小写标志：

```rust
pub struct AttributeSelector {
    pub name: String,
    pub operator: AttributeOperator,
    pub value: String,
    pub case_insensitive: bool,
}
```

`[href="X" i]` 里的 `i` 就是它。

## 伪类

23 个：

```rust
pub enum PseudoClass {
    Root, Empty,
    FirstChild, LastChild, OnlyChild,
    FirstOfType, LastOfType, OnlyOfType,
    NthChild(NthExpression), NthLastChild(NthExpression),
    NthOfType(NthExpression), NthLastOfType(NthExpression),
    Not(Vec<CompoundSelector>),
    Is(Vec<CompoundSelector>),          // :is() 与 :where()
    Hover, Active, Focus, Visited, Link,
    Checked, Disabled, Enabled,
    Lang(String),
}
```

结构伪类覆盖完整，`-of-type` 那四个与普通的四个都有。

**`:nth-child()` 的表达式是结构化解析的**：

```rust
pub struct NthExpression {
    pub a: i64,
    pub b: i64,
}

impl NthExpression {
    pub fn matches(&self, index: i64) -> bool;
}
```

`2n+1`、`-n+3`、`odd`、`even`、`5` 全都能解析成 `(a, b)` 两个数。判据就是 `index = a * k + b` 有没有非负整数解。

**`:lang()` 沿祖先找。** 语言是继承下来的，元素的 `lang` 属性没有就往上找祖先的。匹配按子标签算，`:lang(en)` 能命中 `en-US`。

**`:not()` 只接受复合选择器**，不接受组合器。这是 Selectors 3 的限制，Selectors 4 放开了，这里跟着 3 走。

## 状态

```rust
pub struct ElementState {
    pub hovered: bool,
    pub active: bool,
    pub focused: bool,
    pub visited: bool,
}
```

匹配时作为参数传进来。内核不维护这些状态——它不认识鼠标，所以谁提供？外面。外壳把当前状态告诉内核，内核按状态匹配。

现在外壳不传任何状态（全假），所以 `:hover` 这类规则不会命中。改状态需要重算样式，那条链路还没接。

## 优先级

```rust
pub struct Specificity {
    pub ids: u32,
    pub classes: u32,
    pub types: u32,
}
```

三元组。计算规则：

- id 选择器 → `ids` 加一
- 类选择器与属性选择器 → `classes` 加一
- 伪类 → `classes` 加一
- 类型选择器与伪元素 → `types` 加一
- `*` → 不加
- `:not()` 与 `:is()` → 取内部选择器里最高的那一个

**`:where()` 与 `:is()` 同等对待，这是一个偏离。** Selectors 4 与 Cascade 4 规定 `:where()` 的优先级恒为零，代码里两者走同一个分支，`:where(#id)` 会算出 (1,0,0) 而不是 (0,0,0)。

写 CSS 的人用 `:where()` 通常正是为了压低优先级，所以这个偏离会让样式覆盖的结果与预期不同。

## 解析

```rust
pub fn parse_selector_list(tokens: &[Token]) -> Result<Vec<ComplexSelector>, SelectorError>;
```

`SelectorError` 带一条消息。

**未知的伪类会让整条规则作废。** 规范 §4.1.7 是这么要求的——凡是解析不了的选择器，连同后面的声明块一起忽略，逗号列表里任何一处出错也是整条丢掉。所以 `a:has(b) { color: red }` 里的整条规则会消失，而不是「`:has` 不匹配所以这条规则不生效」。

这两者的区别在别处会有影响：如果页面上还有一条 `a { color: blue }`，按前者 `a` 会变蓝，按后者不会。现在的行为是前者。

## 数字转字符串

```rust
pub fn number_to_css_string(value: f64) -> String;
```

把 `f64` 打回 CSS 的写法，用在 `PropertyValue` 的 `Display` 实现里。整数不带小数点（`1` 而不是 `1.0`），这对调试输出很重要。

## 测试

29 条，覆盖四种组合器的匹配方向、七个属性运算符、结构伪类的边界（`:nth-child(0)`、负数索引、`-of-type` 与兄弟计数）、`:not()` 与 `:is()` 的优先级计算、以及各种不合法输入的报错。

匹配测试的构造方式是「建一棵小 DOM，跑一遍断言」——比手工构造 `ComplexSelector` 结构可读得多。
