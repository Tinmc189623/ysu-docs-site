# 代码风格

格式交给工具，命名和注释交给人。工具管得到的地方不争论，管不到的地方写清楚。

## 格式

```bash
cargo fmt --all
```

`rustfmt.toml` 的内容：

```toml
edition = "2024"
max_width = 100
use_field_init_shorthand = true
use_try_shorthand = true
```

`max_width = 100` 是这个仓库唯一偏离默认的地方。其余全用 rustfmt 的默认值——不为了排版偏好去调一堆选项，读代码的人不该需要先读一份格式化配置。

C++ 侧没有配 `.clang-format`。缩进四格，行宽跟 Qt 的代码风格接近，看一眼 `ui/src/main_window.cpp` 就知道了。

## 静态检查

```bash
cargo clippy --workspace --all-targets
```

无警告。这是硬要求。clippy 报的东西里确实有误报，但处理办法是就地写清楚为什么允许，不是加一个全局的 allow 把整类检查关掉。

## 命名

Rust 侧按社区的惯例：类型 `UpperCamel`，函数与变量 `snake_case`，常量 `SCREAMING_SNAKE`。

有两处是项目特有的：

**内部页面与地址的常量用全大写**，`HOME_URL`、`BLANK_URL`、`HELP_URL`。

**C ABI 的函数全小写下划线**，`ysu_engine_render`。前缀统一是 `ysu_`，两段式的名字里第一段是对象（`engine`、`image`、`page`），第二段是动作（`new`、`free`、`render`、`resolve`）。没有对象的那几个是全局的：`ysu_capi_version`、`ysu_last_error`、`ysu_string_free`、`ysu_fetch`。

## 注释

**函数级注释是硬要求。** 每个公开函数都要有一句说清楚它做什么。不是复述函数名——`/// 取宽度` 对着 `fn width()` 没有信息量——而是说清楚调用它的前提、它的副作用、它失败时的表现。

**解释「为什么」而不是「是什么」。** 代码本身说了是什么。值得写下来的是：为什么这里要用这个判据而不是更直观的那个、为什么不能把这个顺序换过来、这个看起来多余的判断在挡什么。

举几个仓库里真实存在的例子：

```rust
// 键要整段相等，不能只比前缀：清单里同时有 `browser_version` 和 `version`，
// 按前缀找的话 `kernel_version` 也会被当成 `version`。
```

```rust
// 这里必须用三个 f32，不能用 vec3<f32>，否则结构体被撑到 48 字节，
// 与 Rust 侧 32 字节对不上，wgpu 会报校验错误。
```

```rust
// Qt 的 angleDelta 正值表示滚轮往前，也就是内容下移、露出上方的内容；
// 垂直方向取负号正好对上滚动位置减小的方向。
```

这三条的共同点：**删掉之后代码还是对的，但下一个人会把它改错**。这才是注释该拦的东西。

**注释用简体中文。** 项目里没有例外。

## 踩过的坑要不要留在注释里

有一条分界：**描述现状的注释留，描述历史的注释不留。**

```rust
// 好：现在这么做，因为……
let margin = if side.is_auto() { ... };

// 不好：早先这里判的是「是不是零」，于是 margin: 0 与 margin: auto 分不开
```

第二种在代码改对之后就成了误导——读到的人会以为代码还是那样。历史上踩过的坑写进提交信息和文档，写在代码里只会过期。

仓库里现在确实还有几处这样的历史注释，看到了顺手清掉是好的。

## 不留空壳

这条在[设计原则](../introduction/design-principles.md)里说过，在代码风格这一层再重复一次，因为它最容易被违反：

**不写 `todo!()`，不写返回零的实现，不写占位的字段。**

一个语义为空的实现比一个不存在的实现更危险——前者看起来能用。调用方会照着它写代码，然后在某天发现结果一直是零。

没做完的部分记进文档。

## 结构

一个模块一个目录，`mod.rs` 只做导出和模块文档，不放实现。

```rust
//! CSS：词法、选择器、值与规则解析。

pub mod parser;
pub mod selector;
pub mod tokenizer;
pub mod value;

pub use parser::{Declaration, FontFace, MediaContext, PropertyValue, Rule, StyleSheet, ...};
```

`pub use` 把常用的类型提到模块根，调用方写 `ysu::css::Rule` 而不是 `ysu::css::parser::Rule`。

**内部结构不对外。** 结构体字段默认私有，确实需要外部读的才 `pub`。`ComputedStyle` 是个例外——它的字段全是 `pub`，因为它就是个数据载体，布局、绘制、渲染都要读，加一层 getter 只添噪音。

## C++ 侧

**每个 `Q_OBJECT` 类一个头文件加一个源文件**，命名跟类名一致。

**信号槽用函数指针语法**，不用 `SIGNAL` / `SLOT` 宏：

```cpp
connect(address_, &QLineEdit::returnPressed, this, [this] { navigate(address_->text()); });
```

宏写法没有编译期检查，参数写错了要到运行时才发现。

**Qt 对象用父对象管理生命周期**，手写 `delete` 只在该对象没有父对象时用。

**跨线程的信号槽显式写 `Qt::QueuedConnection`。** 默认的自动连接在这种情况下也会选队列连接，但显式写出来读代码的人就不用推断了。

**C ABI 的调用包在 `extern "C"` 里：**

```cpp
extern "C" {
#include "ysu_capi.hpp"
}
```

## 提交之前自查

- [ ] `cargo fmt --all` 跑过
- [ ] `cargo clippy --workspace --all-targets` 无警告
- [ ] `cargo test --workspace` 全过
- [ ] 新增的公开函数有函数级注释
- [ ] 改了 C ABI 的话，头文件与版本号一起改了
- [ ] 改了可见行为的话，文档一起改了
