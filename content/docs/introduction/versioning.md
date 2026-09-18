---
title: "版本号"
description: "内核版本号只有一处来源：仓库根的 version.toml。构建期嵌进程序，运行期不再碰文件。"
---

仓库根的 `version.toml` 是内核版本号的唯一来源：

```toml
[version]
kernel_version = 21.0
```

## 它怎么进到程序里

`build.rs` 在构建期读这个文件，把 `kernel_version` 的值经 `cargo:rustc-env` 传成 `YSU_KERNEL_VERSION`。源码那边只剩一个 `env!`：

```rust
pub const ENGINE_VERSION: &str = env!("YSU_KERNEL_VERSION");
```

版本号是构建期就定死的东西，所以读一次、嵌进去，运行期不必再碰文件。

清单找两处，先看 crate 自己的根目录，再看仓库根——工作区里各 crate 共用仓库根那一份，crate 被单独拿出去发布时则在自己根目录。两处都盯着，改动任一处都要重编。

**两处都没有就退回 `CARGO_PKG_VERSION`。** 少一个文本文件不该让程序编译不过，让它还能起来，显示的版本号不理想是小事。

## 解析为什么不引库

清单是人手写的，结构就一个 `[version]` 段加几个键，所以 `build.rs` 里手写了十几行：跳过注释与空行，认段头，只取 `[version]` 段里的键。

有一处要留意：**键要整段相等，不能只比前缀。** `kernel_version` 与 `browser_version` 都以 `version` 结尾，按前缀找会认错。

## 有一条测试盯着它

退回 `CARGO_PKG_VERSION` 这件事是**安静**发生的——界面上看不出来，版本号照样有，只是错的。所以 `src/lib.rs` 里有一条 `version_comes_from_the_manifest`：打开 `version.toml`，确认里面写的 `kernel_version` 跟嵌进程序的 `ENGINE_VERSION` 是同一个值。

清单不在时它直接跳过。那种情况下退回 Cargo 的版本号正是预期行为，不该报错。

## Cargo.toml 里的号

`Cargo.toml` 里写的 `version = "21.0.0"` 跟清单里的 `21.0` 是同一个数。Cargo 只认三段式的 semver，所以那边多写一段；程序里报出来的是清单里的 `21.0`。

```toml
[package]
name = "ysu"
version = "21.0.0"
edition = "2024"
rust-version = "1.98"
```

改版本号要同时改这两处，`version_comes_from_the_manifest` 会盯着它们是否一致。
