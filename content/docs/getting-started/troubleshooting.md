---
title: "排错"
description: "按「什么时候出的问题」分类。每一条都写清楚现象、原因、怎么办。"
---

按「什么时候出的问题」分类。每一条都写清楚现象、原因、怎么办。

## 构建阶段

### 卡在 aws-lc-sys，错误里出现 cc1 或 cmake

现象：`cargo build` 跑到一半停住，错误信息里出现 `aws-lc-sys`、`cmake` 或者 `cc1`。

原因：TLS 走 rustls，它的密码学后端是 `aws-lc-rs`，里面有一大坨 C 代码要在构建时编出来。纯 Rust 项目不需要 C 工具链这个印象在这里不成立。

怎么办：装上 C 编译器和 CMake。Debian 系 `build-essential` 加 `cmake`，Fedora 系 `gcc gcc-c++ make cmake`。

### html5lib 用例红了一大片

现象：`cargo test --test html5lib_tree` 报出四百多条失败。

原因：**这是预期的，不是构建坏了。** README 里写得很直白：这个测试现在是红的，它报的就是真实差距。

怎么办：不用「修」。想知道差在哪，失败详情写在 `CARGO_TARGET_TMPDIR/html5lib-failures.txt`，那里的每一条都能单独拿出来复现。缺口分类见[测试](../contributing/testing.md)。

## 运行阶段

### 报找不到图形适配器

现象：跑 `render_headless` 或者任何要出像素的代码时，失败信息里说找不到适配器。

原因：机器上没有可用的图形适配器，或者当前环境里取不到。

怎么办：Linux 上装 `mesa-vulkan-drivers` 或厂商驱动。纯 SSH、没有显示服务的环境里，只要有适配器，`render_headless` 仍然能跑——它不建窗口。真的没有适配器就没法出像素，这一点绕不过去。

## 结果看着不对

### 版式跟预期不一样

先看[已知限制](../ysu/known-limitations.md)。几种常见情形是已知的，不是 bug：

- `float` 与 `position: absolute` 会按常规流排——它们解析进了计算样式，但布局侧没有消费方
- 表格的跨行跨列会错位
- `<img>` 不占位，`background-image` 不生效

### 样式表没生效

几种可能，从最常遇到的排起。

**`media` 属性不匹配。** `<style media="...">` 与 `<link media="...">` 上的媒体查询不成立时，整条来源会被跳过——不是里面的规则被忽略，是这一份根本没收进来。

**外链还没取回来。** 内核不自己取样式表。`stylesheet_links()` 把地址交出去，谁调用谁去取，取回一份调一次 `set_linked_stylesheet`。没调过，那份样式表就不在样式表列表里。

**`rel` 不对。** `<link>` 只有在 `rel` 里含 `stylesheet` 这个词才会被认（不分大小写）。`rel="icon"` 之类直接跳过。

**`<style>` 里是空的。** 只有空白字符的样式表会被跳过。

### 点链接没反应

内核的命中测试要求点的位置正好压在文字片段上。`Engine::element_at` 给出的是所在的盒子，点在块级元素范围内的空白处也会命中块本身；判断「点没点在链接上」要用 `Engine::fragment_node_at`，它追到行内内容真正属于哪个节点。

### 伪类规则全都不命中

`:hover`、`:active`、`:focus`、`:visited` 的匹配逻辑写好了，但匹配需要一个元素状态参数，而当前没有任何地方提供它——四项全为假。

这不是匹配算法的毛病，是状态那条链路还没接上。见[选择器](../ysu/selectors.md)。
