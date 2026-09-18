---
title: "代码风格"
description: "格式交给工具，命名和注释交给人。工具管得到的地方不争论，管不到的地方写清楚。"
---

格式交给工具，命名和注释交给人。工具管得到的地方不争论，管不到的地方写清楚。

## 格式

```bash
cargo fmt --all
```

`rustfmt.toml` 的全部内容：

```toml
edition = "2024"
max_width = 100
use_field_init_shorthand = true
use_try_shorthand = true
```

`max_width = 100` 是唯一偏离默认的地方。其余全用 rustfmt 的默认值——不为了排版偏好去调一堆选项，读代码的人不该需要先读一份格式化配置。

## 静态检查

```bash
cargo clippy --all-targets
```

clippy 组件写在 `rust-toolchain.toml` 里，装上工具链就有。

## 命名

按 Rust 社区的惯例：类型 `UpperCamel`，函数与变量 `snake_case`，常量 `SCREAMING_SNAKE`。

模块路径也照这个来：`pub use` 把常用类型提到模块根，调用方写 `ysu::css::StyleSheet`，不用写到 `ysu::css::parser::StyleSheet`。

## 注释

**公开函数要有文档注释。** 说清楚调用它的前提、它的副作用、它失败时的表现。不是复述函数名——`/// 取宽度` 对着 `fn width()` 没有信息量。

**解释「为什么」而不是「是什么」。** 代码本身说了是什么。值得写下来的是：为什么这里要用这个判据而不是更直观的那个、为什么不能把这个顺序换过来、这个看起来多余的判断在挡什么。

仓库里两条真实的例子：

```rust
// 键要整段相等，不能只比前缀：`kernel_version` 与 `browser_version` 都以
// `version` 结尾，按前缀找会认错。
```

```rust
// 这里必须用三个 f32，不能用 vec3<f32>：vec3 的对齐要求是 16 字节，
// 会把整个结构体撑到 48 字节，而 Rust 那边只按 32 字节写入，绑定大小
// 对不上，wgpu 会报校验错误。
```

两条的共同点：**删掉之后代码还是对的，但下一个人会把它改错。** 这才是注释该拦的东西。第二条尤其典型——四个 f32 写成 `[f32; 3]` 看起来只是风格问题，实际是内存布局问题，报错还报在离现场很远的地方。

**注释用简体中文。** 仓库里没有例外。

## 踩过的坑要不要留在注释里

有一条分界：**描述现状的注释留，描述历史的注释不留。**

```rust
// 好：现在这么做，因为……
let margin = if side.is_auto() { ... };

// 不好：早先这里判的是「是不是零」，于是 margin: 0 与 margin: auto 分不开
```

第二种在代码改对之后就成了误导——读到的人会以为代码还是那样。历史上踩过的坑写进提交信息和文档，写在代码里只会过期。

## 不留空壳

这条在[设计原则](../introduction/design-principles.md)里说过，在代码风格这一层再重复一次，因为它最容易被违反：

**不写 `todo!()`，不写返回零的实现，不写占位的字段。**

一个语义为空的实现比一个不存在的实现更危险——前者看起来能用。调用方会照着它写代码，然后在某天发现结果一直是零。

没做完的部分记进文档。

## 结构

一个模块一个目录，`mod.rs` 只做导出和模块文档，不放实现：

```rust
//! CSS：词法、选择器、值与规则解析。

pub mod parser;
pub mod selector;
pub mod tokenizer;
pub mod value;

pub use parser::{
    Declaration, FontFace, MediaContext, PropertyValue, Rule, StyleSheet, parse_stylesheet,
    parse_stylesheet_with_media,
};
```

**内部结构不对外。** 结构体字段默认私有，确实需要外部读的才 `pub`。`ComputedStyle` 是个例外——它的字段全是 `pub`，因为它就是个数据载体，布局、绘制、渲染都要读，加一层 getter 只添噪音。

## 提交之前自查

- [ ] `cargo fmt --all` 跑过
- [ ] `cargo clippy --all-targets` 干净
- [ ] `cargo test` 通过（html5lib 那套本来就有一批红的，看的是有没有变得更多）
- [ ] 新增的公开函数有文档注释
- [ ] 改了可见行为的话，文档一起改了
