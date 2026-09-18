---
title: "构建"
description: "一条 cargo build 编完，四个例子能出数字能出像素，测试跑得上。"
---

```bash
cargo build --release
```

产物落在 `target/release/`。`.gitignore` 忽略 `/target`，构建产物不进版本库。

## 测试

```bash
cargo test
```

跑名字里带某个词的：

```bash
cargo test layout
```

html5lib 那套用例是单独一个测试目标，跑起来慢一些：

```bash
cargo test --test html5lib_tree
```

**这套用例现在是红的**，它报的是真实差距，不是构建坏了。失败详情写在 `CARGO_TARGET_TMPDIR/html5lib-failures.txt`。哪些还没过、为什么，见[测试](../contributing/testing.md)。

## 例子

四个例子，各管一段：

```bash
cargo run --example fetch_probe -- https://example.com/
cargo run --example render_demo
cargo run --example render_headless
cargo run --example render_real_page -- https://example.com/
```

| 例子 | 做什么 | 要不要网络 |
| --- | --- | --- |
| `fetch_probe` | 发一次请求，打印状态、重定向次数、正文长度、`content-type` | 要 |
| `render_demo` | 加载一段内置演示页，打印文档高度、样式表份数、绘制命令条数 | 不要 |
| `render_headless` | 建 GPU 设备、渲到纹理、回读像素并核对关键位置 | 不要 |
| `render_real_page` | 取一个真实网站走完整条链，打印各阶段耗时与文字片段的行位置 | 要 |

改内核的时候，反复开窗口看效果是最慢的一条路。`render_headless` 不用窗口也不用网络，它自己核对像素，着色器、图集、批次划分出了差错它就会报出来——最快的那个是它。`render_demo` 看的是数字，适合确认结构与命令条数有没有突变。

这几个例子都不写图片文件，输出全在终端里。

## 格式化与静态检查

```bash
cargo fmt --all
cargo clippy --workspace --all-targets
```

`rustfmt.toml` 定死四件事：edition 2024、`max_width = 100`，以及两个简写开关（字段初始化与 `?` 运算符的简写形式）。除此之外都是默认值。
