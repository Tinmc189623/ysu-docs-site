# CSS 词法

把一段 CSS 切成记号。971 行，26 条单元测试。

## 记号

```rust
pub enum Token {
    Ident(String),
    Function(String),        // 函数名，后面紧跟 (
    AtKeyword(String),       // @ 开头的关键字
    Charset,                 // 特殊：@charset 单独成一个记号
    Hash(String, bool),      // # 开头的值，布尔量表示是否可能是 id 选择器
    String(String),          // 引号已剥掉
    BadString,               // 遇到未转义换行而收尾的字符串
    Url(String),             // url(...) 里的地址
    BadUrl,                  // 含非法字符的 url(...)
    Number { value: f64, integer: bool },
    Percentage(f64),         // 已经除以一百
    Dimension { value: f64, integer: bool, unit: String },
    Whitespace,
    Cdo,                     // <!--
    Cdc,                     // -->
    Colon, Semicolon, Comma,
    OpenSquare, CloseSquare,
    OpenParen, CloseParen,
    OpenCurly, CloseCurly,
    Delim(char),             // 不属于上面任何一类的单字符
    Eof,
}
```

几个设计点值得说。

**`Hash` 带一个布尔量。** `#abc` 既可能是 id 选择器也可能是颜色值，判断依据是它后面跟的字符类型。词法器知道这个信息（它刚扫过那几个字符），所以顺手记下来，省得解析器回头再看。

**`Charset` 单独成一个记号。** 规范 G.2 里它是带尾空格的字面量 `"@charset "`，而且语义与普通 at 规则不同——它不是条件组，是编码声明。混进 `AtKeyword` 里会让后面多一层判断。

**`BadString` 与 `BadUrl` 不是「用了会出错的记号」，是「必须让整条声明作废的记号」。** 规范 §4.2 要求含它们的声明整条丢掉，所以它们得一路传到声明级解析那里，中途不能被当成值用掉。这一点在枚举里体现为它们不带内容——`BadString` 没有 `String` 那个字段，因为它不该被当成一个字符串用。

## 数字与尺寸

```rust
Number { value: f64, integer: bool },
Percentage(f64),
Dimension { value: f64, integer: bool, unit: String },
```

`integer` 记的是「源码里写的是整数形式吗」——`1` 是整数，`1.0` 不是。这个信息对 `z-index` 这类只接受整数的属性有意义。

`Percentage` 在词法阶段就除以一百，`50%` 的 `value` 是 `0.5`。这样后面所有处理百分比的地方都不用记得除。

`Dimension` 的单位转小写，`10PX` 与 `10px` 一样。

**`1e3` 的归属是一个已知的规范争议点。** CSS 2.1 的 `num` 不含指数，按字面理解 `1e3` 应当是单位 `e3` 的尺寸；而代码把它读成数字 `1000`。更麻烦的是 `1e` 又退回单位 `e`，前后不一致。见[已知限制](known-limitations.md)。

## CDO 与 CDC

```rust
Cdo,   // <!--
Cdc,   // -->
```

这两个是为 HTML 里内嵌样式表的历史写法准备的：

```html
<style>
<!--
div { color: red }
-->
</style>
```

规范要求解析器忽略它们。记号类型定义了，但解析路径上还没有接进去——`skip_whitespace` 只跳空白，不跳这两个。结果是 `<style>` 里第一条规则前面带 `<!--` 时，那条规则会被吃掉。

## 转义

CSS 的标识符里可以写转义：`.\41 b` 表示类名 `Ab`（`\41` 是 `A` 的十六进制码位），`.\35 5ft` 表示类名 `5ft`。

这套转义在 `consume_name`、字符串、`url()` 三处都要处理。现在这三处都只把反斜杠跳过去、保留原文，没有解码。影响是：用转义写的类名匹配不上。真实的 CSS 里这种写法很少见，但生成器产出的代码里会有。

## 已知的规范偏离

`tokenizer.rs` 的 `Token::is_ignorable` 定义了「哪些记号可以直接丢掉」，但全仓没有调用点。

未闭合的字符串和 URL 照样返回可用的值，没有产出 `BadString` / `BadUrl`——上面说了这两个记号类型存在，但构造它们的地方还没接上。

这两条都指向同一件事：**词法层的记号类型是按规范定义完整的，解析路径上的错误恢复还没做完**。见[已知限制](known-limitations.md)。

## 测试

26 条。覆盖各进制数字、百分比、尺寸单位的转义与大小写、字符串的引号与转义、`url()` 的几种写法、注释、以及 `#` 后面跟数字与跟字母的区别。
