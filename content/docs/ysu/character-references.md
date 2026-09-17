---
title: "字符引用"
description: "&amp;、&#65;、&#x41; 这类写法。看起来是个小功能，做对要处理三段东西：一张完整的表、数字引用的码位修正、以及 Windows-1252 的历史遗留。"
---

`&amp;`、`&#65;`、`&#x41;` 这类写法。看起来是个小功能，做对要处理三段东西：一张完整的表、数字引用的码位修正、以及 Windows-1252 的历史遗留。

## 表是生成的，不是手写的

`crates/ysu/src/html/entities.rs` 有 **2231 条**具名引用。这个数字说明它不可能是手写的。

```rust
//! HTML 具名字符引用表。
//!
//! 本文件由 `tools/generate_entities.py` 从 WHATWG 的 `entities.json`
//! 生成，不要手工编辑。表按名字的字节序排列，查询走二分查找。

pub static NAMED_REFERENCES: &[(&str, &str)] = &[
```

数据源是 <https://html.spec.whatwg.org/entities.json>，里面列了全部具名字符引用，包括**带分号与不带分号两种形式**。两种都进表，因为规范允许在某些上下文里省略分号（`&amp` 后面不跟字母数字时等价于 `&amp;`）。

生成方式：

```bash
curl -sS -o /tmp/entities.json https://html.spec.whatwg.org/entities.json
python3 crates/ysu/tools/generate_entities.py /tmp/entities.json \
    crates/ysu/src/html/entities.rs
```

表按名字的字节序排列，查询走二分查找。

## 查找

```rust
pub struct NamedReference { /* ... */ }

/// 在 `&` 之后的部分里查找最长的具名字符引用。
///
/// `input` 是 `&` 之后的全部剩余文本。返回 `None` 表示没有任何引用匹配，
/// 此时调用方应当把 `&` 当作普通字符处理。
pub fn lookup_named(input: &str) -> Option<NamedReference>;
```

注意「**最长**」两个字。`&notin;` 和 `&not` 都以 `&not` 开头，正确的结果取决于输入：

| 输入 | 结果 |
| --- | --- |
| `&notin;` | `∉`（U+2209） |
| `&notin` | `¬in`——`&not` 匹配上了，剩下的是字面文本 |
| `&not;` | `¬` |

所以查找必须从最长往下试，不能碰到第一个匹配就返回。

`references.rs` 里有一个常量记着表里最长的名字长度，用来限定尝试范围：

```rust
/// 表里最长的名字长度，用来限定查找时的尝试范围。
```

## 数字引用

```rust
/// 解码 `&#` 开头的数字字符引用。
///
/// `input` 是 `&#` 之后的剩余文本，进制前缀 `x` 或 `X` 由本函数自行识别。
/// 一个数字都没有时返回 `None`，调用方应当按解析错误处理并原样输出。
pub fn lookup_numeric(input: &str) -> Option<NumericReference>;
```

`&#65;` 是十进制，`&#x41;` 是十六进制，两种都认。一个数字都没有（比如 `&#x;`）返回 `None`。

## 码位修正

数字引用解出来的码位不能直接用，要过一遍修正：

```rust
/// 按规范修正数字引用解出来的码位。
///
/// 空字符、代理对范围与超出 Unicode 的码位一律换成替换字符；0x80 到 0x9F
/// 这一段是 Windows-1252 的历史遗留映射，规范要求照该表替换。
```

三段规则：

**空字符、代理对范围（U+D800 到 U+DFFF）、超出 Unicode 范围的码位**，一律换成替换字符 `U+FFFD`。这些码位在 Unicode 里不合法，直接构造出来会产生无效字符串。

**`0x80` 到 `0x9F` 这一段走 Windows-1252 映射表。** 这是历史遗留：早期网页把 Windows-1252 的字符按码位直接写成 `&#150;` 这种形式，而 `150` 在 Unicode 里是控制字符。规范为了兼容，要求照 Windows-1252 的表替换。`&#150;` 得到 `–`（U+2013 短破折号），不是 U+0096。

**`0x0D` 换成 `0x0A`。** 回车统一成换行。

## 统一入口

```rust
pub fn decode_character_references(text: &str) -> String;
```

给一段文本，把里面所有引用解掉。`&` 后面既不是名字也不是数字时，`&` 保持原样——`a & b` 里的 `&` 是普通的和号。

## 覆盖率

2231 条不是个小数字，值得说一下它意味着什么：全部 HTML 具名引用都在表里，包括那些罕见到几乎没人在页面上写过的（`&NotNestedGreaterGreater;`、`&bigtriangleup;`、`&varepsilon;`）。

有些实现只放常用的一两百个，遇到别的就原样输出。那样在真实页面上多数时候看不出问题——直到某个数学页面上的 `&nleqq;` 显示成了一串字符。

这里选了完整表。代价是一个两千多行的生成文件，收益是这一类问题不会出现。

## 测试

`references.rs` 里的测试覆盖：最长匹配（`&notin;` 与 `&notin` 的区别）、分号省略的边界、数字引用的两种进制、码位修正的三条规则、Windows-1252 映射表的几个端点、以及不构成引用时的原样输出。

`html/tokenizer.rs` 里也有几条，测的是引用解码与原始文本模式的交互——RCDATA 里解码，RAWTEXT 里不解码。
