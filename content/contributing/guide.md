# 参与开发

从改一行到提交的完整流程。

## 先跑通构建

```bash
cargo build --release
cargo build --release -p ysu-capi
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Release
cmake --build ui/build -j
./ui/build/vexo
```

跑不起来的话先看[准备环境](../getting-started/prerequisites.md)和[排错](../getting-started/troubleshooting.md)。构建不通的情况下改代码容易改出自己没法验的东西。

## 找一件事做

按「你想碰哪一层」选入口：

| 想做的事 | 从哪开始 |
| --- | --- |
| 让某个 CSS 属性生效 | `crates/ysu/src/style/cascade.rs` 里的分派，再看 `layout/` 有没有人读 |
| 修排版 | `crates/ysu/src/layout/`，先看 `engine.rs` 的入口 |
| 改渲染效果 | `crates/ysu/src/render/`，着色器在 `shaders.rs` |
| 修 HTML 解析 | `crates/ysu/src/html/`，注意 html5lib 的回归 |
| 改外壳行为 | `ui/src/` |
| 扩展脚本引擎 | `crates/jse/src/` |

## 提交之前

三条都要干净：

```bash
cargo fmt --all
cargo clippy --workspace --all-targets
cargo test --workspace
```

clippy 无警告是这个项目的硬要求，不是建议。测试里有一条会跑 1700 多条 html5lib 用例，慢一些，但它是 HTML 那一层唯一的规模化回归，别跳过。

## 改了 C ABI 的话

四处一起改，一处都不能漏：

1. `ui/include/ysu_capi.hpp` 的函数声明
2. `crates/ysu-capi/src/lib.rs` 的实现
3. 头文件里的 `#define YSU_CAPI_VERSION`（加一）
4. `crates/ysu-capi/src/lib.rs` 里的 `const VERSION: u32`（与上一条相等）

然后：

```bash
cargo build --release -p ysu-capi
cmake --build ui/build -j
```

漏了第 1 步，`header_matches_the_implementation` 测试会报。漏了第 3、4 步，`header_version_matches_the_library` 会报。

## 修 bug 的流程

这个项目的 bug 大多有个共同点：**看代码看不出来，只有跑一遍才知道**。所以流程是先复现、再定位、最后才改。

**复现优先用离屏渲染，不要反复开窗口：**

```bash
cargo run -p ysu-capi --example dump_frame -- /tmp/before.ppm 1.0 home 200
```

改完再出一张，两张对着看。比在窗口里滚动找差异快得多，也能存档。

**涉及网络的用第二条：**

```bash
cargo run -p ysu-capi --example fetch_render -- https://example.com/ /tmp/out.ppm
```

它会把取回的 HTML 存一份到 `/tmp/fetched.html`。这样能分清「取回来的东西不对」和「取回来是对的但画得不对」。

**修完加一条测试。** 这个项目里几乎每个修掉的 bug 都留了一条回归测试，钉住当时的失败条件。没有测试的修复迟早会回来。

## 提交信息

写清楚改了什么和为什么。「修 bug」不算提交信息，「行内块宽度写死成零导致同一行多个行内块叠在一起」才算。

改内核的时候，值得在信息里说清楚是「解析对了但布局不认」还是「整条路径都不存在」——这两种情况的排查方式完全不同。

## 一次改动尽量小

改一个东西就只改一个东西。内核的层与层之间耦合紧，一次改三层的话，出问题时无从判断是哪一层引起的。

例外是「补一条完整的路径」——比如让某个属性从解析一路走到绘制，那本来就涉及三四个文件，拆开反而每步都不完整。

## 不留空壳

没做完的功能不写进代码。不要 `todo!()`，不要返回零的实现，不要「先占个位置」的字段。

没做完的部分记进文档，不写进代码。理由在[设计原则](../introduction/design-principles.md)里：一个语义为空的实现比一个不存在的实现更危险，因为它看起来能用。

## 文档

改了可见行为就要改文档。公开文档在文档站的 `content/` 目录里，改 C ABI 的话 `capi/` 那几篇都要看一眼。

文档里写「支持」的门槛是：代码里确实有这条路径，而且能被测试或截图验证。解析进来了但没人读的，一律写「未实现」。

## 提交

提交信息末尾带上：

```
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

（这条适用于用 AI 协助完成的改动。）

## 许可

提交即表示同意以项目的许可条款发布你的贡献。许可条款见仓库根的 `LICENSE`。
