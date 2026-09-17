# CSS 解析

把记号流组织成规则与声明。1212 行，27 条单元测试。

## 产物

```rust
pub struct StyleSheet {
    pub rules: Vec<Rule>,
    pub font_faces: Vec<FontFace>,
}

pub struct Rule {
    pub selectors: Vec<ComplexSelector>,
    pub declarations: Vec<Declaration>,
}

pub struct Declaration {
    pub property: String,
    pub value: PropertyValue,
    pub important: bool,
}
```

`Rule` 是「选择器列表 + 声明表」。一条规则带多个选择器时（`h1, h2 { }`）它们在解析阶段就被放进同一个 `Rule`——它们的声明表完全一样，拆开只会让层叠那边多遍历几遍。

`!important` 在这里就记下来了，不在层叠阶段再解析一遍。

## 值的分类

```rust
pub enum PropertyValue {
    Keyword(String),        // 已转小写
    Length(Length),
    Number(f64),
    Angle(f64),             // 单位是度
    Color(Color),
    String(String),
    Url(String),
    LengthList(Vec<Length>),   // margin: 1px 2px
    NumberList(Vec<f64>),
    KeywordList(Vec<String>),  // font-family: A, B
    MixedList(Vec<PropertyValue>),  // border: 1px solid red
}
```

「能归类的都归了类，归不了的保留原始记号」。这句话是这一层的设计意图：颜色、长度、角度这些常见的值在解析阶段就变成结构化的类型，后面的层叠与布局拿到的是 `Length` 而不是一个字符串。

取值用一组 `as_*` 方法：

```rust
impl PropertyValue {
    pub fn as_keyword(&self) -> Option<&str>;
    pub fn as_length(&self) -> Option<Length>;
    pub fn as_number(&self) -> Option<f64>;
    pub fn as_color(&self) -> Option<Color>;
    pub fn as_length_list(&self) -> Option<Vec<Length>>;
    pub fn as_keyword_list(&self) -> Option<Vec<String>>;
}
```

有两个宽松处理值得注意：

**`as_length` 把纯数字零当成零长度。** `margin: 0` 里的 `0` 在词法层是 `Number`，不是 `Dimension`（没有单位）。规范允许 `0` 不带单位，所以这里兜了一下。

**`as_length_list` 把单个长度包装成长度为一的列表。** `margin: 1px` 与 `margin: 1px 1px 1px 1px` 等价的那些简写规则因此不用在调用方各写一遍。

**`as_number` 会把无单位长度里的数值也取出来。** 这一条有个副作用：`line-height: 20px` 的 `20px` 会被当数字 20 取出来。见下面「已知问题」。

## 长度单位

```rust
pub enum LengthUnit {
    None, Px, Em, Rem, Vw, Vh, Vmin, Vmax, Percent,
    Pt, Pc, In, Cm, Mm, Q, Ch, Ex,
    Auto,
}
```

绝对单位有换算表：

| 单位 | 像素 |
| --- | --- |
| `px` | 1 |
| `pt` | 4/3 |
| `pc` | 16 |
| `in` | 96 |
| `cm` | 96/2.54 |
| `mm` | 96/25.4 |
| `q` | 96/101.6 |

相对单位（`em`、`rem`、`vw`、`vh`、`vmin`、`vmax`、`%`）在解析阶段保留原样，换算留给布局——它们要知道上下文才能算。

`Auto` 放在 `LengthUnit` 里是有意的：

```rust
/// `auto`。
///
/// 它不是长度，但在「这一边交给布局自己决定」这个意义上和长度同处一个
/// 位置，所以放在这里当一种单位。解析成像素时是零，需要区分的地方用
/// [`Length::is_auto`] 判断——外边距的居中就是靠它区分的。
```

这一条解决的是 `margin: 0 auto` 与 `margin: 0` 分不开的问题。前者要居中，后者要贴左，两者在「解析成像素」之后都是零。

## at 规则

解析器只分派两种：

```rust
"media" => { /* 就地按当前视口求值，满足条件的规则提升到外层 */ }
"font-face" => { /* 收进字体表 */ }
```

**`@media` 在解析阶段就求值。** `MediaContext` 带当前视口宽高，规则满足条件时它的内容直接提升到外层，不满足就整块丢掉。这样后面的层叠不用再管媒体查询。

```rust
pub struct MediaContext {
    pub width: f64,
    pub height: f64,
}

pub fn parse_stylesheet(css: &str) -> StyleSheet;
pub fn parse_stylesheet_with_media(css: &str, media: MediaContext) -> StyleSheet;
```

**`@font-face` 收进 `FontFace`**（family、weight、style、source 四项），但 `font_faces` 目前没有消费方——字体文件既没下载也没注册。见[已知限制](known-limitations.md)。

其余的 at 规则**整块跳过**：

| at 规则 | 现在 |
| --- | --- |
| `@import` | 不处理，后面的内容被跳过 |
| `@supports` | 不处理 |
| `@namespace` | 不处理 |
| `@keyframes` | 不处理 |
| `@page` | 不处理 |

跳过是安全的——不影响静态排版的东西丢掉之后，页面只是少了那些效果，不会排错。

**`@media only screen` 有一个具体的坑。** `only` 关键字没有分支，`only screen` 既不等于 `screen` 也不等于 `all`，整条查询恒不匹配。而这是现实页面里最常见的写法之一。见[已知限制](known-limitations.md)。

## 声明级的错误恢复

一条声明解析失败时，解析器跳到下一个分号继续，而不是放弃整条规则。所以：

```css
p { color: red; bogus: ; background: blue }
```

`bogus` 那条被丢掉，`color` 与 `background` 正常生效。

这条恢复逻辑是有意做出来的，不是碰巧——写错一条声明让整条规则失效，会让调试变得很难。

## 已知问题

**`line-height: 20px` 会被静默忽略。** `as_number` 对带单位的长度返回 `None`，而 `line-height` 的解析只吃无单位数字与 `normal`。结果是这样写不生效，也不报错，`line-height` 保持原值。

**`1e3` 的归属不一致。** 词法层把它读成数字 1000，`1e` 又退回单位 `e`。见 [CSS 词法](css-tokenizer.md)。

**未闭合字符串照样生效。** 规范要求产出 `BadString` 并丢弃整条声明，现在照样返回可用的值。

## 接口

```rust
impl StyleSheet {
    pub fn parse(css: &str) -> Self;
    pub fn extend(&mut self, other: StyleSheet);
}
```

`extend` 把另一份样式表并进来。外部样式表取回之后就是靠它逐份并入的。

## 测试

27 条，覆盖规则与声明的解析、各简写形式的展开、媒体查询的匹配、错误恢复的几个分支、`!important` 的识别、以及值的分类。
