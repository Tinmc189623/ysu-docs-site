---
title: "仓库结构"
description: "一个 crate，仓库根就是它。源码按管线阶段分目录，一个目录对应一环。"
---

YSU 是一个 crate，仓库根目录就是它。没有工作区，也没有子 crate——`Cargo.toml` 里写着 `name = "ysu"`，版本 `21.0.0`，edition 2024，`rust-version = "1.98"`，许可是 Apache-2.0。

```
Cargo.toml          crate 清单
build.rs            构建期把版本号从 version.toml 嵌进程序
version.toml        内核版本号，唯一来源
rust-toolchain.toml 工具链钉在 1.98.1，含 rustfmt 与 clippy
rustfmt.toml        格式化配置，max_width = 100
src/                内核源码
examples/           四个例子，从取网页到出图各管一段
tests/              html5lib 树构建用例，以及跑它的测试
tools/              辅助脚本
```

## `src/`

十个模块。排在前面的产出是排在后面的输入：

```
address.rs   地址栏输入的解析与相对地址补全
engine.rs    门面，把下面这些串起来
html/        词法分析、字符引用解码、树构建
css/         词法、值与规则解析、选择器
dom/         节点树与查询
style/       层叠、继承、计算样式
layout/      盒子树、布局引擎、几何、文本
paint/       显示列表与绘制命令生成
render/      wgpu 渲染器、字形图集、着色器
net/         HTTP/1.1 与 HTTPS 客户端、字符集嗅探
```

顺序跟 `src/lib.rs` 里的模块声明不完全一样——那里是按字母排的，这里按数据流排。

各模块内部的文件：

```
html/    tokenizer.rs  tree_builder.rs  references.rs  entities.rs  foreign.rs
css/     tokenizer.rs  parser.rs  selector.rs  value.rs
dom/     node.rs
style/   cascade.rs  computed.rs
layout/  box_tree.rs  engine.rs  geometry.rs  text.rs
paint/   display_list.rs  painter.rs
render/  renderer.rs  atlas.rs  shaders.rs
net/     client.rs  http.rs  encoding.rs
```

`html/entities.rs` 是生成出来的，两千多条具名字符引用，别手工改——改它要改 `tools/generate_entities.py` 再重新生成。

## `src/lib.rs` 露出什么

十个模块全部 `pub`，再加一条 `pub use engine::Engine`。两个常量跟着一起出去：

```rust
pub const ENGINE_NAME: &str = "YSU";
pub const ENGINE_VERSION: &str = env!("YSU_KERNEL_VERSION");
```

`ENGINE_VERSION` 不是写死的，`env!` 取的那个值由 `build.rs` 在构建期从 `version.toml` 读出来传进去。

`lib.rs` 里还有一条测试盯着这件事：`version_comes_from_the_manifest` 会打开 `version.toml`，确认里面写的 `kernel_version` 跟嵌进程序的 `ENGINE_VERSION` 是同一个值。清单不在时（crate 被单独拿出去发布）它就跳过——那种情况下退回 Cargo 的版本号正是预期行为。

## `build.rs`

构建期做一件事：从 `version.toml` 取 `kernel_version`，经 `cargo:rustc-env` 传成 `YSU_KERNEL_VERSION`。版本号是构建期定死的东西，嵌进去之后运行期不必再碰文件。

清单找两处，先看 crate 自己的根目录，再看仓库根。两处都没有就退回 `CARGO_PKG_VERSION`——少一个文本文件不该让程序编译不过。

解析是手写的十几行，没引 TOML 库。注释里写明了为什么键要整段相等而不是比前缀：`kernel_version` 与 `browser_version` 都以 `version` 结尾，按前缀找会认错。

## `examples/`

四个例子，各自跑法就是 Rust 的常规方式：

```bash
cargo run --example fetch_probe -- https://example.com/
cargo run --example render_demo
cargo run --example render_headless
cargo run --example render_real_page -- https://example.com/
```

| 例子 | 做什么 |
| --- | --- |
| `fetch_probe` | 对一个真实站点发一次请求，打印状态、重定向次数、正文长度、`content-type`，以及正文开头的两百来字 |
| `render_demo` | 加载一段内置的演示页，打印文档高度、样式表份数、绘制命令条数与全部文字 |
| `render_headless` | 离屏渲染。自己建 GPU 设备、渲到纹理、把像素读回来，核对四个位置的取值 |
| `render_real_page` | 取一个真实网站，解析、取它引用的外部样式表、布局、绘制，打印各阶段耗时与文字片段的行位置 |

`render_headless` 是唯一真的验证像素的那个。它不用窗口，在没有显示服务的机器上也能跑，着色器、图集、批次划分出了差错它就会报出来。其余三个看数字和文字。

这几个例子都不写图片文件，输出全在终端里。

## `tests/`

一个测试目标，`tests/html5lib_tree.rs`，配 `tests/html5lib/` 下从 html5lib-tests 取来的用例。它是内核里唯一的规模化回归，也是唯一一份外人能拿去核对的标准——各浏览器与 Servo 用的是同一份数据。

用例的总数、通过数，以及现在还没过的那些，见[测试](../contributing/testing.md)。

## `tools/`

`generate_entities.py` 一个脚本。从 WHATWG 的 `entities.json` 生成 `src/html/entities.rs`，按名字的字节序排好，查询时走二分查找。脚本头部的用法注释里还留着 `crates/ysu/` 那截老路径，照它敲会找不到文件——路径以仓库当前的布局为准。
