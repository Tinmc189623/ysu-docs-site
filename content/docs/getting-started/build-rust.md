---
title: "构建 Rust 侧"
description: "Rust 侧是一个 Cargo 工作区，五个成员：ysu（内核）、ysu-capi（C ABI）、jse（脚本引擎）、json、vexo（旧外壳）。"
---

Rust 侧是一个 Cargo 工作区，五个成员：`ysu`（内核）、`ysu-capi`（C ABI）、`jse`（脚本引擎）、`json`、`vexo`（旧外壳）。

## 全都编一遍

```bash
cargo build --release
```

产出在 `target/release/`。这一步会把 `crates/vexo` 也一起编——那个旧外壳还留在工作区里。

## 只编内核与静态库

外壳需要的是 `libysu_capi.a`，可以单独编：

```bash
cargo build --release -p ysu-capi
```

产物 `target/release/libysu_capi.a` 就是 C++ 外壳要链的东西。

`ysu-capi` 的 crate 类型是 `["staticlib", "rlib"]`。静态库给 C++ 用；rlib 让 `examples/` 下的例子能在 Rust 里直接调同一套 ABI 函数——不经过 C 编译器，走的是同一份二进制接口。

> 改了 C ABI 的任何签名之后必须重新跑这条命令。外壳可能还链着旧库，启动时版本号对不上会弹对话框直接退出。那是故意的：参数错位的调用比退出危险得多。

## 测试

```bash
cargo test --workspace
```

按名字跑单条：

```bash
cargo test -p ysu caption_is_placed_inside_table
```

内核的 html5lib 用例单独一个测试目标，跑起来慢一些：

```bash
cargo test -p ysu --test html5lib_tree
```

失败时会把前若干条详情写进 `target/html5lib-failures.txt`，比在终端里滚屏方便。

## 格式化与静态检查

```bash
cargo fmt --all
cargo clippy --workspace --all-targets
```

`rustfmt.toml` 定死 `max_width = 100`，别的都是默认值。提交之前这两条都应该干净——clippy 无警告是这个项目的硬要求。

## 不看窗口看渲染结果

改内核的时候，反复开窗口看效果是最慢的一条路。两个例子走的是和外壳完全相同的 C ABI，出图到文件：

```bash
# 对照页渲染成图片。参数：输出路径、设备像素比、第三位传 home 换成起始页、滚动位置
cargo run -p ysu-capi --example dump_frame -- /tmp/frame.ppm 1.0 home 200

# 完整走一遍外壳的加载流程：取页面、取它引用的样式表、应用、渲染
cargo run -p ysu-capi --example fetch_render -- https://example.com/ /tmp/out.ppm
```

第一条用的是内置的对照页，不联网，跑得快。它上面有圆角、行内块、表格，适合看版式改动有没有把别处弄坏。

第二条会真的发网络请求，并且把取回的 HTML 原样存一份到 `/tmp/fetched.html`——对比「取回来的东西对不对」和「画出来的东西对不对」时很有用。

输出是 PPM。多数图片查看器直接就认，不认的话转一下：

```bash
convert /tmp/frame.ppm /tmp/frame.png
```

内核自己的 `examples/` 下还有四个例子，直接以 Rust 调内核，不过 C ABI：

```bash
cargo run -p ysu --example render_demo
```

## 内核开发时的常用组合

```bash
cargo test -p ysu layout            # 跑名字里带 layout 的测试
cargo run -p ysu-capi --example dump_frame -- /tmp/a.ppm 2.0 home 0   # 高分屏下的排版
```

设备像素比传 2.0 再传 1.0，两张图的**高度必须一样**。高度一样说明断行位置没变，也就是排版没被像素比影响；只有成像分辨率变了。这条是内核里最容易搞错的换算之一。

## 构建产物

| 路径 | 是什么 |
| --- | --- |
| `target/release/libysu_capi.a` | C ABI 静态库，外壳链它 |
| `target/release/libvexo` | 旧 Rust 外壳的可执行文件 |
| `target/debug/` | 调试构建，外壳找不到 release 库时会退回这里 |
| `target/html5lib-failures.txt` | html5lib 用例失败时的详情 |

`.gitignore` 忽略 `/target`，但**没有**忽略 `ui/build/`。在外壳目录里构建之前注意这一点。
