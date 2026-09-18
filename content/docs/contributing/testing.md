---
title: "测试"
description: "最常跑的两条命令，一份现在的规模，以及那套红着的 html5lib 回归。"
---

```bash
cargo test
```

跑名字里带某个词的：

```bash
cargo test layout
```

## 规模

`src/` 下 439 条单元测试，散在各个源文件的 `#[cfg(test)]` 模块里。密度最高的一批：

| 文件 | 条数 |
| --- | --- |
| `html/tokenizer.rs` | 39 |
| `html/tree_builder.rs` | 36 |
| `layout/engine.rs` | 32 |
| `style/cascade.rs` | 29 |
| `css/selector.rs` | 29 |
| `engine.rs` | 27 |
| `css/parser.rs` | 27 |
| `css/tokenizer.rs` | 26 |
| `paint/painter.rs` | 20 |
| `net/http.rs` | 20 |
| `render/renderer.rs` | 16 |
| `layout/box_tree.rs` | 16 |

再往下是 `html/references.rs`、`dom/node.rs` 各 14 条，`style/computed.rs`、`layout/text.rs`、`css/value.rs` 各 13 条，`net/encoding.rs` 与 `address.rs` 各 12 条，`net/client.rs` 10 条，其余文件零星几条。

## html5lib 树构建回归

内核里唯一的规模化回归，也是唯一一份外人能拿去核对的标准。

```bash
cargo test --test html5lib_tree
```

用例来自 [html5lib-tests](https://github.com/html5lib/html5lib-tests) 的一份快照，收在 `tests/html5lib/` 下，来源与许可见那里的 README。

| | |
| --- | --- |
| 用例总数 | 1792 |
| 通过 | 1368 |
| 失败 | 424 |
| 其中片段解析 | 192 条，通过 159 |

**这套用例现在是红的，它报的就是真实差距。** 主要几块缺口：

- `template` 的内容没有单独建模，约 111 条
- 格式化元素的收养机构算法还有边角没对齐，约 137 条，多数是同一个名字的格式化元素层层嵌套
- 表格与寄养约 40 条，`select` 约 21 条

失败详情写在 `CARGO_TARGET_TMPDIR/html5lib-failures.txt`。一条一条都能单独拿出来复现。

判据上有两处取舍，都是为了数字不虚高：

**只比对树，不比 `#errors`。** 用例里的 `#errors` 段记的是规范要求报出哪些解析错误，这里跳过。代价是「树对但错误报得不全」发现不了，属于已知的覆盖盲区。

**片段解析一起跑，不单独排除。** 挡在外面会让通过率虚高，那种数字没有意义。

## 三层

**单元测试**在源文件的 `#[cfg(test)]` 模块里，测一个函数的输入输出。这是最多的一类。

**集成测试**在 `tests/` 下，内核只有一个：html5lib 那套。

**例子**在 `examples/` 下。它们不是测试，但承担了端到端验证的角色——`render_headless` 会自己核对像素，比断言更直观。

## 不碰设备的那些测试

`render/renderer.rs` 里那 16 条全部避开 GPU 设备，测的是纯计算：

- sRGB 转换的端点与中点
- 颜色转线性时 alpha 保持不变
- 剪刀矩形：减去滚动偏移、丢弃滚出视野的盒子、随缩放与像素比缩放、贴到表面边界时钳制
- 顶点写入的浮点数个数（矩形与字形各 12 个）
- 边框拆解：实线四条、双线八条、虚线切段、零宽度不产生命令
- 实例步长与着色器布局一致

剪刀矩形那条尤其值得留意——漏减滚动偏移的问题，正是把这些换算从 `Renderer` 的方法里抽成自由函数之后才被测试抓住的。

真正的成像验靠 `render_headless` 那个例子：它建设备、渲到纹理、把像素读回来，核对四个关键位置的颜色。

## 真的走 socket 的那些测试

`net/client.rs` 的测试会**真的开一个本地监听端口**，起一个只回一次响应的假服务器：`TcpListener::bind("127.0.0.1:0")` 让系统分配端口，避免测试之间抢同一个。客户端走的是真实的 socket 路径，不是打桩的。

## 单元测试怎么写

**测行为，不测实现。** 断言最终结果，不断言中间步骤，重构实现时测试就不用改。

**一个测试一个点。** 名字写清楚测什么，失败时不用读代码就知道坏在哪：

```rust
#[test]
fn scissor_subtracts_the_scroll_offset() { ... }

#[test]
fn dotted_border_segments_are_square() { ... }
```

**用真实的输入。** 测 HTML 就给一段真的 HTML，测 CSS 就给一条真的声明。手工构造内部结构的话，测的是「构造出来的东西对不对」而不是「解析出来的东西对不对」。

## 回归测试

修 bug 的时候，**先写一条能复现的测试，再改代码**。

写完之后在改代码之前先跑一遍，看到它红了，这条测试才有意义。没见过它红的测试可能是恒真的。
