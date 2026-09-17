# 构建外壳（Linux）

C++ / Qt6 那层用 CMake 构建。它链接 Rust 侧先编出来的静态库，所以顺序不能反。

## 一条条来

```bash
# 1. 先把静态库编出来
cargo build --release -p ysu-capi

# 2. 配置
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Release

# 3. 构建
cmake --build ui/build -j

# 4. 跑
./ui/build/vexo
```

第二条会把 `ui/build/` 建出来。这个目录不在 `.gitignore` 里，提交之前留意别把整个构建目录加进去。

## CMake 在做什么

`ui/CMakeLists.txt` 很短，值得读一遍。它做四件事：

**找静态库。** 先看 `target/release/libysu_capi.a`，没有就看 `target/debug/libysu_capi.a`，都没有就报错：

```
找不到 YSU 静态库：/path/to/ui/../target/release/libysu_capi.a
先在仓库根目录跑 cargo build --release -p ysu-capi
```

库路径存在 CMake 的缓存变量 `YSU_LIB` 里，想换一份显式传：

```bash
cmake -S ui -B ui/build -DYSU_LIB=/path/to/libysu_capi.a
```

**找 Qt6。** `find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets)`。缺模块时配置阶段就会失败，错误信息里会写清楚缺哪个。

**开 AUTOMOC。** 三个类都有 `Q_OBJECT`，moc 生成的代码靠这个开关自动跑。没开的话会在链接阶段报一堆找不到 `vtable` 的错。

**链系统库。** 除了 `Qt6::Widgets` 和静态库，还要 `pthread`、`dl`、`m`。这三个是 Rust 标准库要的，少一个就会在链接阶段报一堆看不懂的符号缺失。

## 换个构建目录

`ui/build` 只是个习惯写法，换哪个目录都行：

```bash
cmake -S ui -B /tmp/vexo-build -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/vexo-build -j
```

CMake 指令是相对当前工作目录解析的，所以路径写清楚就行，不必先进 `ui/`。

## 重新构建的时机

只有 C++ 侧改动时：

```bash
cmake --build ui/build -j
```

改了 C ABI 的签名，或者改了内核里任何东西：

```bash
cargo build --release -p ysu-capi && cmake --build ui/build -j
```

只改内核内部实现、没动 C ABI 的话，理论上重新链一下静态库就够了，但 CMake 未必知道静态库换过了。拿不准就重新配置一次：

```bash
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Release && cmake --build ui/build -j
```

## 清一遍

```bash
rm -rf ui/build
```

CMake 的缓存里记着绝对路径，整个仓库挪过位置之后必须清掉重建，否则会指向旧路径上的库。

## 运行时的常见问题

**窗口起不来，报找不到适配器。** Vulkan 驱动没装，或者跑在没有图形会话的环境里（比如纯 SSH）。装 `mesa-vulkan-drivers`，或者用 `vulkaninfo` 看一眼有什么设备。

**启动弹「版本不匹配」然后退出。** 链接的静态库和头文件不是同一版。回到仓库根重新 `cargo build --release -p ysu-capi` 再链一次。

**画面全白。** 页面可能真的没内容，也可能是渲染失败保留了上一帧。看看终端里有没有错误输出。

**中文输不进地址栏。** 地址栏是 Qt 的 `QLineEdit`，输入法走 Qt 的插件。装 `fcitx5-qt` 或 `ibus-qt` 之类的包，重启程序即可，不改代码。
