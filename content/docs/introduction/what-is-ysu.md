---
title: "YSU 是什么"
description: "网页渲染内核。把 HTML 与 CSS 变成可以交给 GPU 绘制的显示列表，不依赖系统自带的网页控件。"
---

YSU 是网页渲染内核。它把 HTML 与 CSS 变成可以交给 GPU 绘制的显示列表，不依赖系统自带的网页控件。

数据沿一条单向管线流动，每一步的产物是下一步的输入：

```text
html::Tokenizer    →  记号流
html::TreeBuilder  →  节点树
css::Parser        →  样式表
style::Cascade     →  每个节点的计算样式
layout::Tree       →  带尺寸和位置的盒子树
paint::DisplayList →  绘制命令
render::Renderer   →  wgpu 的绘制调用
```

每一步都能单独调用。想验选择器匹配，直接喂一段 CSS 和一棵节点树；想验布局，直接构造一棵盒子树。整条链只有做端到端验证时才需要跑全。渲染器只负责把显示列表翻译成绘制调用，换渲染后端只动 `render/` 一个模块。

## 它不做什么

**不创建 GPU 设备。** `Device` 与 `Queue` 由调用方建好后传进来。设备不在内核手里，它就能脱离窗口单独跑——`render_headless` 这个例子正是这么在没有显示服务的机器上核对像素的——设备的生命周期也只归调用方管。

**不生产文档。** 内核只解析递给它的那一份。起始页、空白页、出错提示这些都不在它这里，`src/address.rs` 的模块注释把话写得很直白：内核不认识「自己提供的页面」这种说法。

**不处理界面事件。** 它能按坐标回答某个点上压着哪个节点（`Engine::element_at`），行内内容还能追到具体是哪个节点的文字（`Engine::fragment_node_at`，判断点在不在链接上要靠它）。至于点下去要做什么，不归它管。

## 它对外露出什么

对 Rust 调用方是一个门面 `Engine`：建实例、设视口、喂 HTML、重新布局、取显示列表、按坐标做命中测试。`src/lib.rs` 里再没有别的门面。

十个模块也全部公开，所以中间产物随时能单独拿出来——这正是上面那句「每一步都能单独调用」的落点。

## 现在到哪一步了

判据是 [html5lib-tests](https://github.com/html5lib/html5lib-tests) 的树构建用例，各浏览器与 Servo 用的是同一份，不是为本项目定制的。这批用例现在是**红的**，README 里如实写着「它报的就是真实差距」：

| | |
| --- | --- |
| 用例总数 | 1792 |
| 通过 | 1368 |
| 失败 | 424 |
| 其中片段解析 | 192 条，通过 159 |

已知的几处缺口：`template` 的内容没有单独建模，格式化元素的收养机构算法还有边角没对齐，表格与寄养、`select` 各有一批没过。样式表那边 `calc()` 与 `var()` 没做，`@import`、`@supports`、`@page` 没接，`position` 与 `float` 解析进了计算样式但布局侧没有消费方。网页脚本不执行，`<script>` 会被解析进节点树，但没人跑它。

这些缺口的细目见[支持范围](../ysu/support-status.md)与[已知限制](../ysu/known-limitations.md)。

## 规模

`src/` 下两万两千五百多行。

| 模块 | 行数 |
| --- | --- |
| `html/` | 6913 |
| `css/` | 4518 |
| `layout/` | 3443 |
| `style/` | 2110 |
| `render/` | 1646 |
| `net/` | 1224 |
| `paint/` | 1107 |
| `engine.rs` | 672 |
| `dom/` | 611 |
| `address.rs` | 250 |
| `lib.rs` | 66 |

单元测试 439 条，散在各个源文件的 `#[cfg(test)]` 模块里。除此之外还有 `tests/` 下那套 html5lib 回归，和 `examples/` 下四个能出图、能取网页的例子。

## 许可

Apache License 2.0，全文见仓库根的 `LICENSE`。

Copyright © 2026 Nexsteaduser. All Rights Reserved.
