---
title: "词法与语法"
description: "JSE 已经完成的两层。语法覆盖面按 ECMAScript 规范走，细节处按上下文校验。"
---

JSE 已经完成的两层。语法覆盖面按 ECMAScript 规范走，细节处按上下文校验。

## 记号

`TokenKind` 有 14 个变体：

```rust
Number(f64)                 数值字面量
BigInt(String)              BigInt，保存去掉 n 后缀的十进制文本
String(String)              字符串，转义已解
NoSubstitutionTemplate(String)   没有插值的模板串
TemplateHead(String)        模板串的头部，到第一个 ${ 为止
TemplateMiddle(String)      ${ } 之间的中段
TemplateTail(String)        最后一个 } 到结束
RegExp { .. }               正则字面量
Identifier(String)          标识符
Keyword(Keyword)            关键字
BooleanLiteral(bool)        true / false
NullLiteral                 null
Punctuator(Punctuator)      运算符与标点
Eof                         输入结束
```

模板串分成四种记号，是因为 `a${b}c${d}e` 里每一段的处理方式不同：头部之后要按表达式扫，中段两边都是表达式，尾部之后回到普通状态。用一个「模板串」记号会让解析器不得不重新扫一遍。

**正则字面量需要重扫。** `/` 既可能是除号也可能是正则的开头，词法器本身判不出来——`a / b` 和 `/re/` 在只看到斜杠的那一刻没区别。处理办法是让解析器在需要表达式的位置回过头让词法器按正则重扫。

`Keyword` 有 33 个，`Punctuator` 有 57 个。

每个记号带一个 `Span`（起止偏移），一路传到语法树上。

## 语法

`ExprKind` 的 26 个变体：

```
Identifier  Literal  This  Super  NewTarget  ImportMeta
Array  Object  Function  Arrow  Class
Unary  Update  Binary  Logical  Assignment  Conditional
Call  New  Member  Chain  Sequence
Template  TaggedTemplate  Await  Yield
```

`StmtKind` 的 21 个变体：

```
Expression  Block  Empty  Variable  Function  Class
Return  If  While  DoWhile  For  ForIn  ForOf
Break  Continue  Throw  Try  Switch  Labeled  Debugger  With
```

解析器是**递归下降加优先级爬升**：语句层用递归下降，表达式层用优先级爬升处理二元运算符的结合性与优先级。

### 上下文的校验

有几处语法不是「看到关键字就能定」，要看上下文：

**箭头函数需要试探。** `(a, b)` 后面跟 `=>` 才是箭头函数，不跟就是括号表达式。解析器要先把括号里的东西按参数列表试一遍，不行再退回去当表达式解。这个回溯是在记号缓冲上做的，不是重新扫描源码。

**`with` 在严格模式下非法。**

**`yield` 只在生成器里合法，`await` 只在异步函数里合法。**

**严格模式指令。** 函数体开头是 `"use strict"` 字面量表达式时，整个函数体切进严格模式，后续解析的校验规则随之变化。

**自动分号插入。** 规范里 ASI 的判据之一是「换行前不能继续解析」。词法器在记号上记了「前面有没有换行」，解析器靠它判断能不能在这里断句。

### 解构与展开

`Pattern` 有五个变体，覆盖标识符、数组解构、对象解构、剩余元素、默认值。它出现在三个地方：变量声明的左侧、函数参数、赋值的左侧。

`ends_with_rest()` 和 `bound_names()` 两个辅助方法是给调用方用的：前者判末尾是不是剩余元素，后者把绑定的名字收集出来。

对象解构的成员可以是简写、键值对、计算键、或者嵌套的模式，各有各的解析分支。

### 类

`Class` 结构带一个可选的父类表达式、一组成员、以及成员之间的分号。成员分方法、取值器、设值器、字段四类，静态的另算。

**字段初始化和私有名（`#x`）已经解析进语法树**，但因为还没有执行器，这些语义没有实际行为。

## 语法树的形状

```rust
pub struct Expr {
    pub kind: ExprKind,
    pub span: Span,
}
```

同一种分类 + 位置分离的写法贯穿整棵树。`Literal` 单独是一个类型，它自己带 `Span`（因为字面量的位置也要能单独取）。

## 导出格式

`ast::dump` 把语法树打成文本：

```rust
pub fn program_to_string(program: &Program) -> String;
pub fn expression_to_string(expression: &Expr) -> String;
```

输出是缩进的、一行一个节点的形式：

```
Program
  VariableDeclaration kind=let
    Declarator
      Identifier a
      Binary +
        Literal 1
        Literal 2
```

这个格式的用途是测试断言。写解析器的测试如果靠模式匹配断言，一个测试要写十几行，而且改动 AST 结构时所有测试一起失效。打成文本之后，断言就是两个字符串的比较。

它也方便调试：解析出一棵奇怪的树时，先 dump 出来看一眼比在调试器里展开结构快。

## 一个使用例子

```rust
use jse::{ast::dump, parser};

let program = parser::parse_script("const a = 1 + 2;")?;
println!("{}", dump::program_to_string(&program));

let expression = parser::parse_expression("f(x, ...rest)")?;
println!("{}", dump::expression_to_string(&expression));
```

## 测试

解析器的测试主要断言 dump 出来的文本。这套做法覆盖面广、写起来快，代价是测试文件里的期望文本比较长。改动语法树结构时要批量更新这些期望文本。
