# 仓库结构

```
crates/ysu          渲染内核。HTML/CSS 解析、DOM、样式、布局、绘制、渲染、网络、地址规则
crates/ysu-capi     YSU 的 C ABI，产出 staticlib + rlib，外壳经它调内核
crates/jse          JavaScript 引擎。词法与语法树完成，运行期刚起步
crates/json         JSON 解析与序列化，内核与引擎共用
crates/vexo         旧的 Rust 外壳，已被 ui/ 取代，仍留在工作区里
ui/                 C++17 / Qt6 外壳，浏览器本体
docs/               文档
version.toml        版本号来源
```

## `crates/ysu`

内核。内部按阶段分目录，一个目录对应管线的一环。

```
src/html/      词法器、树构建、字符引用表、外来内容（SVG/MathML）
src/dom/       arena 结构的节点树
src/css/       词法、解析、选择器、值
src/style/     层叠、继承、计算样式
src/layout/    盒子树、布局引擎、几何、文本
src/paint/     显示列表与绘制命令生成
src/render/    wgpu 渲染器、字形图集、着色器
src/net/       HTTP/1.1 客户端、TLS、字符集嗅探
src/address.rs 地址栏输入的解析
src/pages.rs   内置页面（起始页、空白页、说明页、加载页、错误页）
src/engine.rs  门面，把上面这些串起来
```

`tests/` 下是 html5lib 的树构建测试数据与跑它的测试；`tools/generate_entities.py` 是生成字符引用表的脚本。

## `crates/ysu-capi`

一个文件，`src/lib.rs`，一千四百行，26 个 `extern "C"` 函数。`examples/` 下三个可执行例子直接以 Rust 调这些函数，走的是和外壳完全相同的路径。

`crate-type = ["staticlib", "rlib"]`。静态库给 C++ 链，rlib 让例子和测试能在 Rust 里调同一套 ABI 函数。

## `crates/jse`

```
src/lexer/     记号与扫描
src/parser/    表达式、语句、模式
src/ast/       语法树定义与导出
src/runtime/   运行期，目前只有数字抽象操作
```

## `crates/json`

JSON 的值类型、解析器、序列化器、错误类型。内核和引擎共用，不引第三方 JSON 库。

## `ui/`

外壳。四个源文件，各管一块。

| 文件 | 职责 |
| --- | --- |
| `main.cpp` | 启动：建 QApplication、设应用名与版本、校验 ABI 版本、开主窗口 |
| `main_window.*` | 主窗口。工具栏、地址栏、标签栏、快捷键、网络请求的汇合点 |
| `browser_tab.*` | 一个标签页。持有自己的内核实例、导航历史，地址解析 |
| `viewport.*` | 视口部件。持有 `YsuEngine*`，把内核交出的像素贴到屏幕上 |

`include/ysu_capi.hpp` 是手写的 C ABI 头文件，和 `crates/ysu-capi/src/lib.rs` 一一对应。改签名要同时改两边，并把 `YSU_CAPI_VERSION` 加一。

`CMakeLists.txt` 找 `target/release/libysu_capi.a`，找不到就退回 debug 版本，都没有就报错并告诉你该跑哪条命令。

## `crates/vexo`

旧的 Rust 外壳，用 winit 加自绘界面，曾经是 Vexo 本体。外壳换成 C++ / Qt6 之后它退到一边，代码还在工作区里，`cargo build --workspace` 会连它一起编。它同样通过 C ABI 调内核，所以内核的行为不因它而变。

现在只用它做一件事：`crates/vexo/src/platform/` 下三个平台的窗口后端实现，是未来可能用得上的素材。日常开发和发布都走 `ui/`。

## `version.toml`

版本号的唯一来源。内核版本、浏览器版本、脚本引擎版本各一行，编译期嵌进程序，经 `ysu_engine_version` 交给外壳显示。外壳不硬编版本号。这个文件由人写，不由工具生成。

## 工作区

Cargo workspace，resolver 3，edition 2024，`rust-version = "1.98"`。工具链由 `rust-toolchain.toml` 钉在 1.98.1，含 rustfmt 与 clippy。格式化配置在 `rustfmt.toml`，`max_width = 100`。

release 档开了 `lto = "thin"`、`codegen-units = 1`、`panic = "abort"`。最后一条意味着跨 FFI 不会发生栈展开，出问题就是进程直接停。
