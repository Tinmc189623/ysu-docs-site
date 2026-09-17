---
title: "其他平台的构建"
description: "这个项目只在 Linux x86_64 上验证过。下面写的是「按现有代码推断应该怎么做」与「哪些地方确实没验过」，两者分清楚，别把前者当保证。"
---

这个项目只在 Linux x86_64 上验证过。下面写的是「按现有代码推断应该怎么做」与「哪些地方确实没验过」，两者分清楚，别把前者当保证。

## Rust 侧

`crates/ysu`、`crates/ysu-capi`、`crates/jse`、`crates/json` 的依赖都是跨平台的，没有 `cfg(target_os)` 分支，也没有平台专属的系统调用。三个平台上应当都能直接构建：

```bash
cargo build --release -p ysu-capi
```

有一处要注意：TLS 走 rustls，密码学后端是 `aws-lc-rs`，它要编译 C 代码。

- **Windows** 需要 CMake 和一个 C 编译器（MSVC 或者 MinGW 的都行），另外 `aws-lc-sys` 在 x86_64 Windows 上可能还需要 NASM。
- **macOS** 需要 Xcode 命令行工具，`xcode-select --install` 装上就行。

## 外壳

`ui/CMakeLists.txt` 里没有任何平台判断：`Qt6` 的 Core / Gui / Widgets 三个模块三个桌面平台都有，C++17 也是。所以要移植的话，改动量可能只是把 `pthread`、`dl` 换掉。

现在的链接段是这样：

```cmake
target_link_libraries(vexo PRIVATE
    Qt6::Widgets
    "${YSU_LIB}"
    pthread
    dl
    m
)
```

`dl` 在 macOS 上不存在（合并进了 libSystem），会直接报找不到。Windows 上 `pthread` 与 `dl` 都没有，MSVC 也不需要。所以这一处要按平台分开写：

```cmake
if(UNIX AND NOT APPLE)
    target_link_libraries(vexo PRIVATE pthread dl m)
endif()
```

**这段代码还没写进仓库，也没有在 macOS 或 Windows 上构建过。** 上面只是「按现状推断下一步要改哪里」，不是一份验证过的移植方案。

## 没有验证的部分

具体哪些是推断，哪些是事实：

| 事项 | 状态 |
| --- | --- |
| Rust 侧在 Windows / macOS 上编译 | 未验证 |
| `libysu_capi.a` 在 Windows 上的产出形式（MSVC 下静态库通常叫 `.lib`） | 未验证 |
| CMake 找到 Qt6 | 未验证 |
| `pthread` / `dl` / `m` 的链接 | 未验证，且已知在 macOS 与 Windows 上需要改 |
| 窗口能起、能渲染、能跑起来 | 未验证 |
| `setDesktopFileName` 在 macOS / Windows 上的行为 | 未验证。这个调用是 Linux 桌面环境用来归类窗口的，别的平台上是空操作 |

## Windows 上的一点额外说明

静态库的命名是个具体问题。MSVC 工具链下 Rust 产出的静态库扩展名是 `.lib` 而不是 `.a`，`CMakeLists.txt` 里写死的 `libysu_capi.a` 找不到。MinGW 工具链下则是 `.a`，沿用现状就行。

同样的，MSVC 与 MinGW 产出的静态库**不能混用**：Rust 侧用 `-msvc` 目标编，C++ 侧也得用 MSVC 编。混着链会在链接阶段报符号找不到，或者更糟——链上了但运行期崩。

## macOS 上的一点额外说明

打包成 `.app` 的时候，`QApplication::setDesktopFileName` 不起作用（那是 Linux 的机制）。macOS 要靠 `Info.plist` 里的 bundle identifier。仓库里没有任何 `.plist`，也没有 `.desktop` 文件——桌面集成这一块现在只在 Linux 上以运行时声明的方式存在。

## 想帮忙验证

如果你手上有 macOS 或 Windows 机器，最有用的一件事是把构建跑通然后把链接段的改法提回来。改动量估计很小，但需要有人在真机器上验证，而不是靠推断。
