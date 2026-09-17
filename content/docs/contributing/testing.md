---
title: "测试"
---

```bash
cargo test --workspace
```

按名字跑单条：

```bash
cargo test -p ysu caption_is_placed_inside_table
```

按模块跑一批：

```bash
cargo test -p ysu layout
```

## 规模

| 位置 | 测试数 |
| --- | --- |
| `crates/ysu` | 447 |
| `crates/jse` | 125 |
| `crates/vexo` | 115 |
| `crates/json` | 44 |
| `crates/ysu-capi` | 14 |

内核里分布比较均匀，每个模块都有自己的单元测试：CSS 词法 26、选择器 29、层叠 29、树构建 36、HTML 词法 39、布局引擎 32、绘制 20、网络 42、地址 12、内置页面 8、门面 27。

## 三层测试

**单元测试**在源文件的 `#[cfg(test)]` 模块里，测一个函数的输入输出。这是最多的一类。

**集成测试**在 `tests/` 下，把模块串起来测。内核只有一个：html5lib 的树构建回归。

**示例程序**在 `examples/` 下。它们不是测试，但承担了端到端验证的角色——出了图就能看，比断言更直观。

## html5lib 树构建回归

内核最重要的一个测试目标。

```bash
cargo test -p ysu --test html5lib_tree
```

### 数据从哪来

来自 <https://github.com/html5lib/html5lib-tests> 的一个具体提交快照，MIT 许可。

钉的是一个提交而不是 master，原因写在 `crates/ysu/tests/html5lib/README.md` 里：那次之后树构建用例搬去了 web-platform-tests，原仓库只留词法用例，跟 master 会跟丢。

`tree-construction/` 下 57 个 `.dat` 文件，共 **1709 条**用例，其中 192 条带 `#document-fragment`。

### 怎么跑

测试函数只有一个，它会：

1. 扫 `tree-construction/` 下的 `.dat` 文件（**非递归**，所以 `scripted/` 子目录里那 3 个文件不参与）
2. 逐条解析，把产出的树按 html5lib 的格式打成文本
3. 和期望文本比对
4. 失败时把详情写进 `target/html5lib-failures.txt`

最后打印一行汇总，形如：

```
共 N 条，可核对 N 条，通过 N 条，失败 N 条，片段解析尚未支持 N 条
```

### 判据的两处取舍

**只比对树，不比 `#errors`。** 用例里的 `#errors` 段记的是规范要求报出哪些解析错误。内核不维护错误列表，所以这一段跳过。这意味着「树对但错误报得不全」不会被发现——是已知的覆盖盲区。

**片段解析单列。** 带 `#document-fragment` 的用例既不算通过也不算失败，单独计入「尚未支持」。

片段解析本身在 `TreeBuilder::new_fragment` 里是实现了的（`ysu::html::parse_fragment` 是它的公开入口），只是还没纳入这 192 条用例的比对。**把这些用例接进去是一件明确可做的事**，收益是内核里最大的一块未验证面积变成已验证。

### 为什么这个测试重要

HTML 树构建的规范描述里全是「在这种情况下把这几个元素从栈里弹掉」这样的句子。光靠读代码判断实现对不对是不可能的——1709 条真实用例是唯一的规模化验证。

改了树构建之后一定要跑它。它是这一层唯一能发现「改一处、坏三处」的手段。

## 单元测试怎么写

**测行为，不测实现。** 断言最终结果，不断言中间步骤。这样重构实现时测试不用改。

**一个测试一个点。** 名字写清楚测什么，失败时不用读代码就知道坏在哪：

```rust
#[test]
fn caption_is_placed_inside_table() { ... }

#[test]
fn percentage_radius_uses_shorter_side() { ... }
```

**用真实的输入。** 测 HTML 就给一段真的 HTML，测 CSS 就给一条真的声明。手工构造内部结构的话，测的是「构造出来的东西对不对」而不是「解析出来的东西对不对」。

## 回归测试

修 bug 的时候，**先写一条能复现的测试，再改代码**。

这个项目里几乎每个修掉的问题都留了回归测试，钉住当时的失败条件。没有测试的修复迟早会回来——尤其是内核里那些「只在特定组合下才出现」的问题。

写回归测试的时候有个技巧：**先确认它能失败**。写完之后在改代码之前跑一遍，看到它红了，这条测试才有意义。没见过它红的测试可能是恒真的。

## 涉及 GPU 的测试

`render/renderer.rs` 有 16 条测试，但它们不能真的建 GPU 设备——那样测试在没显卡的机器上就挂了。

所以渲染那一层测的是**纯函数部分**：坐标换算、颜色转换、剪刀矩形的计算。这些是渲染里最容易出错的地方，也恰好是不依赖设备的部分。

把换算逻辑从 `Renderer` 的方法里抽成自由函数，一部分原因就是为了能测。剪刀矩形漏减滚动那个问题，抽出来之后才被单元测试覆盖住。

真正的成像验靠示例程序出图人眼看。

## 涉及网络的测试

`net/client.rs` 的测试会**真的开一个本地 TCP 监听端口**，用一个假的服务器回预置的响应。所以它测的是完整的 HTTP 解析路径，不是打桩的。

这类测试要注意端口冲突——测试之间可能抢同一个端口。现在用的是让系统分配端口的方式。

## 示例程序

```bash
cargo run -p ysu-capi --example dump_frame -- /tmp/frame.ppm 1.0 home 200
```

参数是：输出路径、设备像素比、第三位传 `home` 换成起始页、滚动位置。

内置的对照页上有圆角、行内块、表格。它是改版式时最方便的一张基准图——改完出一张，和之前那张对着看。

```bash
cargo run -p ysu-capi --example fetch_render -- https://example.com/ /tmp/out.ppm
```

走完整的加载流程，会把取回的 HTML 存一份到 `/tmp/fetched.html`。

内核自己的四个例子：

```bash
cargo run -p ysu --example render_demo
cargo run -p ysu --example render_headless
cargo run -p ysu --example render_real_page
cargo run -p ysu --example fetch_probe
```

## 一条有用的断言

设备像素比不该影响排版。验法是同一个页面、同样的逻辑尺寸，出两张图：

```bash
cargo run -p ysu-capi --example dump_frame -- /tmp/a.ppm 1.0 home 0
cargo run -p ysu-capi --example dump_frame -- /tmp/b.ppm 2.0 home 0
```

两张图的**高度必须一样**。高度一样说明断行位置没变，也就是排版没被像素比影响；只有成像分辨率变了。

这条能抓住内核里最容易搞错的一类问题：把物理尺寸当逻辑尺寸用。传错了的时候文字会小四分之一，而「小四分之一」用眼睛看不出来，只有和参考图比对才发现。
