---
title: "准备环境"
description: "一个 Rust 工具链，外加一个 C 编译器和 CMake。"
---

内核是单个 Rust crate，没有工作区，也没有别的语言。

## Rust

**1.98.1。** 工具链由仓库根的 `rust-toolchain.toml` 钉住：

```toml
[toolchain]
channel = "1.98.1"
components = ["rustfmt", "clippy"]
```

`Cargo.toml` 里写的 `rust-version = "1.98"` 是同一个下限。装了 rustup 的话，进到仓库目录就自动切到 1.98.1，不用手动装。

## 一个 C 编译器和 CMake

这条容易漏：仓库是纯 Rust 的，但 TLS 走 rustls，它的密码学后端是 `aws-lc-rs`，里面有一大坨 C 代码要编。`Cargo.lock` 里能查到 `aws-lc-rs` 与 `aws-lc-sys` 两条。

所以即使只构建内核，也需要：

- 一个 C 编译器，GCC 或 Clang 都行
- `cmake`

Debian 系装 `build-essential` 与 `cmake`，Fedora 系装 `gcc gcc-c++ make cmake`。少了它们，构建会停在一个看起来跟网络毫无关系的依赖上——错误信息里出现 `aws-lc-sys`、`cmake` 或 `cc1` 就是这个原因。

## 图形适配器

渲染层用 wgpu。要真的跑出像素，机器上得有一个找得到的图形适配器，Linux 上通常是 `mesa-vulkan-drivers` 或厂商驱动。

不需要窗口。`examples/render_headless.rs` 自己建 GPU 设备、渲到纹理、把像素读回来核对，在没有显示服务的机器上也能跑。

## 依赖

运行期只有六个：

| 依赖 | 干什么 |
| --- | --- |
| `url` | 地址解析 |
| `encoding_rs` | 字符集解码 |
| `cosmic-text` | 文本整形与栅格化 |
| `wgpu` | GPU 接口 |
| `rustls` | TLS |
| `webpki-roots` | 根证书 |

开发依赖一个：`pollster`，用来在例子里同步等 GPU 的异步调用。

除此之外的每一层——HTML 词法与树构建、CSS 词法与选择器、层叠、布局、绘制、HTTP 客户端——都是仓库自己的代码。

## 平台

只在 Linux x86_64 上验证过。依赖都是跨平台的，代码里没有 `cfg(target_os)` 分支，但别的平台上没有实测过。
