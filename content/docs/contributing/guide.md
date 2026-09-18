---
title: "参与开发"
description: "从改一行到提交的完整流程。"
---

从改一行到提交的完整流程。

## 先跑通构建

```bash
cargo build --release
cargo test
```

跑不起来的话先看[准备环境](../getting-started/prerequisites.md)。构建不通的情况下改代码，容易改出自己没法验的东西。

`cargo test` 会带上 html5lib 那套用例，它本来就有一批红的——那是已知差距，不是你的改动弄坏的。判断标准是数量有没有变多，见[测试](./testing.md)。

## 找一件事做

按「你想碰哪一层」选入口：

| 想做的事 | 从哪开始 |
| --- | --- |
| 让某个 CSS 属性生效 | `src/style/cascade.rs` 里的分派，再看 `src/layout/` 有没有人读它 |
| 修排版 | `src/layout/`，先看 `engine.rs` 的入口 |
| 改渲染效果 | `src/render/`，着色器在 `shaders.rs` |
| 修 HTML 解析 | `src/html/`，改完记得跑 html5lib 那套 |
| 改 CSS 词法或选择器 | `src/css/`，词法在 `tokenizer.rs`，匹配在 `selector.rs` |
| 改网络行为 | `src/net/`，HTTP 在 `http.rs`，socket 在 `client.rs` |
| 改地址判断 | `src/address.rs` |

## 提交之前

三条：

```bash
cargo fmt --all
cargo clippy --all-targets
cargo test
```

html5lib 那套有一千多条用例，跑起来慢一些，但它是 HTML 那一层唯一的规模化回归，别跳过。

## 修 bug 的流程

先复现、再定位、最后才改。这个项目的 bug 大多有个共同点：**看代码看不出来，只有跑一遍才知道。**

复现优先用例子，不要靠猜：

```bash
# 渲染一段内置页面，打印结构与命令条数
cargo run --example render_demo

# 取一个真实网站走完整条链
cargo run --example render_real_page -- https://example.com/
```

`render_real_page` 会把各阶段的耗时和文字片段的行位置都打出来，能分清是「取回来的东西不对」还是「取回来是对的但画得不对」。

涉及像素的问题用 `render_headless`，它自己核对几个关键位置的颜色，红了会直接报哪一处不符。

**修完加一条测试。** 条件允许的话，先确认它在你改代码之前是红的。

## 提交信息

写清楚改了什么和为什么。「修 bug」不算提交信息，「行内块宽度写死成零导致同一行多个行内块叠在一起」才算。

改内核的时候值得说清楚是「解析对了但布局不认」还是「整条路径都不存在」——这两种情况的排查方式完全不同。

## 一次改动尽量小

改一个东西就只改一个东西。层与层之间耦合紧，一次改三层的话，出问题时无从判断是哪一层引起的。

例外是「补一条完整的路径」——比如让某个属性从解析一路走到绘制，那本来就涉及三四个文件，拆开反而每步都不完整。

## 不留空壳

没做完的功能不写进代码。不要 `todo!()`，不要返回零的实现，不要「先占个位置」的字段。

没做完的部分记进文档。理由在[设计原则](../introduction/design-principles.md)里：一个语义为空的实现比一个不存在的实现更危险，因为它看起来能用。

## 文档

改了可见行为就要改文档。文档里写「支持」的门槛是：代码里确实有这条路径，而且能被测试或例子验证。解析进来了但没人读的，一律写「未实现」——`position` 与 `float` 就是照这个口径写的。

## 许可

提交即表示同意以项目的许可条款发布你的贡献。Apache License 2.0，全文见仓库根的 `LICENSE`。
