---
title: "准备环境"
description: "构建分两段：Rust 侧先编出内核与静态库，然后 CMake 把 C++ 外壳链上去。两段各有一套依赖。"
---

构建分两段：Rust 侧先编出内核与静态库，然后 CMake 把 C++ 外壳链上去。两段各有一套依赖。

## Rust 侧

**Rust 1.98.1。** 工具链由仓库根的 `rust-toolchain.toml` 钉住：

```toml
[toolchain]
channel = "1.98.1"
components = ["rustfmt", "clippy"]
```

装了 rustup 的话，进目录就会自动切到 1.98.1，不用手动装。用系统包管理器装的 Rust 只要版本不低于 1.98 也行——工作区的 `rust-version` 是这么写的。

**一个 C 编译器，外加 CMake。** 这条容易漏。TLS 走 rustls，它的默认密码学后端是 `aws-lc-rs`，里面有一大坨 C 代码要编。所以即使你只构建 Rust 侧，也需要 `cc` 和 `cmake` 在位，否则会在某个看起来与网络毫无关系的依赖上卡住。

Debian / Ubuntu 上：

```bash
sudo apt install build-essential cmake
```

Fedora 系：

```bash
sudo dnf install gcc gcc-c++ make cmake
```

**图形驱动。** 内核用 wgpu 渲染，Linux 上走 Vulkan 后端。开发时不需要独立显卡，Mesa 的软件光栅化能跑：

```bash
sudo apt install mesa-vulkan-drivers
```

没装驱动时不会构建失败，是运行时报「找不到适配器」。

## C++ 外壳

**CMake 3.16 或更高。** `ui/CMakeLists.txt` 第一行就是这个下限。

**Qt 6 的 Core、Gui、Widgets 三个模块。** 版本没写死下限，本机验证用的是 6.10.2。

Debian / Ubuntu：

```bash
sudo apt install qt6-base-dev
```

Fedora：

```bash
sudo dnf install qt6-qtbase-devel
```

Arch：

```bash
sudo pacman -S qt6-base
```

**C++17 编译器。** CMake 配置里写死 `C++17`，`CMAKE_CXX_STANDARD_REQUIRED ON`。GCC 9 以上或 Clang 10 以上都没问题。

## 检查一下

```bash
rustc --version          # 期望 1.98.1
cargo --version
cmake --version          # 期望 3.16 以上
qmake6 --version         # 能打出来就说明 Qt6 开发包在了
cc --version
```

Qt 也许没装 `qmake6` 这个可执行文件（有些发行版把它拆到单独的包里），用下面这条更可靠：

```bash
ls /usr/lib/x86_64-linux-gnu/cmake | grep Qt6
```

能列出 `Qt6Widgets`、`Qt6Gui`、`Qt6Core` 就没问题。路径随发行版和架构变，Debian 系在 `/usr/lib/<架构>/cmake`，Fedora 在 `/usr/lib64/cmake`。

## 磁盘和内存

一次完整构建的 `target/` 目录在 3 GB 上下。release 开了 `lto = "thin"` 和 `codegen-units = 1`，链静态库那一步会比较慢，四核机器上整轮十分钟左右。

调试构建快得多，但 `target/debug/libysu_capi.a` 会大不少。CMake 优先找 release 版本的库，找不到才退回 debug——想把外壳链到 debug 库上，配置时显式指定：

```bash
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Debug -DYSU_LIB=$PWD/target/debug/libysu_capi.a
```

## 其他平台

Rust 侧的依赖都是跨平台的。外壳那层用的是 Qt6，三个桌面平台都有，但只在 Linux x86_64 上验证过。见[其他平台的构建](./build-ui-other-platforms.md)。
