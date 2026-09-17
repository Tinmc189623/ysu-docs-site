# JSE 总览

JSE 是 Vexo 用的 JavaScript 引擎，全部由 Rust 实现，不依赖任何现成的 JS 引擎。它是独立的 crate（`crates/jse`），可以脱离浏览器单独用。

现在的状态是：**词法与语法分析完成，运行期只有数字的抽象操作**。能解析、能导出语法树，不能执行。

## 四个模块

```
src/lexer/    源码 → 记号流
src/parser/   记号流 → 语法树
src/ast/      语法树定义与导出
src/runtime/  运行期（目前只有数字）
```

`lib.rs` 里画的分层是这样的：每一层只依赖它下面的一层。词法不认识语法，语法不认识运行期。

除 `number.rs` 之外，`runtime/` 是空的。没有值类型，没有对象模型，没有执行器，没有内建对象。

## 公开接口

```rust
pub mod ast;
pub mod lexer;
pub mod parser;
pub mod runtime;

pub const ENGINE_NAME: &str = "JSE";
pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
```

### 词法

```rust
pub fn tokenize(src: &str) -> Result<Vec<Token>, LexError>;
```

还有 `Scanner` 类型给需要逐记号取用的场景，以及 `is_identifier_start` / `is_identifier_continue` 两个字符判定函数。

### 语法

两个便利函数：

```rust
pub fn parse_script(src: &str) -> Result<Program, ParseError>;
pub fn parse_expression(src: &str) -> Result<Expr, ParseError>;
```

需要更细的控制时用 `Parser`：

```rust
let mut parser = Parser::new(src)?;
let program = parser.parse_script()?;
```

`Parser` 上有一组公开的辅助方法（`peek`、`bump`、`expect_punctuator`、`at_contextual` 等），是给扩展语法时用的。

### 语法树导出

```rust
pub fn program_to_string(program: &Program) -> String;
pub fn expression_to_string(expression: &Expr) -> String;
```

输出是稳定的文本格式，测试用它做断言——比手写一堆模式匹配好读得多。

### 运行期

```rust
pub fn number_to_string(value: f64) -> String;
pub fn to_int32(value: f64) -> i32;
pub fn to_uint32(value: f64) -> u32;
pub fn to_integer_or_zero(value: f64) -> f64;
pub fn to_length(value: f64) -> u64;
pub fn is_safe_integer(value: f64) -> bool;
pub fn is_integer(value: f64) -> bool;
```

就这些。这是运行期的全部。

## 没有宿主接口

`lib.rs` 的模块文档里写着「要让它访问 DOM 或 `window`，由宿主实现 `Host` 接口把自己的对象接进来」。

**这个接口还不存在。** crate 里没有任何 `trait` 关键字，也没有 `builtins` 模块。那句话记的是设计意图，不是现状。

要接脚本执行，第一步是把 `Host` 定义出来，而不是去实现一个已有的接口。

见[进展与缺口](status.md)。

## AST 的形状

表达式和语句都是「带区间的节点」结构：节点自身的分类放在 `kind` 里，位置信息放在外层的 `span`：

```rust
pub struct Expr {
    pub kind: ExprKind,
    pub span: Span,
}
```

这样每个变体不用重复携带 `Span`，模式匹配的时候也更干净——要位置就取 `expr.span`，要分类就匹配 `expr.kind`。

`ExprKind` 有 26 个变体，`StmtKind` 有 21 个。全列在[词法与语法](lexer-and-parser.md)里。

## 名字

`ENGINE_NAME` 是 `"JSE"`，`ENGINE_VERSION` 跟 crate 的包版本走。产品版本号（外壳显示的那个）来自 `version.toml`，不是这里。
