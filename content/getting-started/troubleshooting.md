# 排错

按「什么时候出的问题」分类。每一条都写清楚现象、原因、怎么办。

## 构建阶段

### 在 aws-lc-sys 上卡住或报错

现象：`cargo build` 跑到一半停住，错误信息里出现 `aws-lc-sys`、`CMake` 或者 `cc1`。

原因：TLS 走 rustls，它的默认密码学后端要编译 C 代码，所以需要一个 C 编译器和 CMake。很多人以为纯 Rust 项目不需要这些。

怎么办：装上 `build-essential` 与 `cmake`（Debian 系），或 `gcc gcc-c++ make cmake`（Fedora 系）。

### CMake 报「找不到 YSU 静态库」

```
找不到 YSU 静态库：/path/to/ui/../target/release/libysu_capi.a
先在仓库根目录跑 cargo build --release -p ysu-capi
```

原因：顺序反了。CMake 配置阶段就要求静态库存在。

怎么办：先 `cargo build --release -p ysu-capi`。

### CMake 报找不到 Qt6

现象：`find_package(Qt6 ...)` 失败，或者缺 `Qt6Widgets`。

原因：只装了运行时的 Qt，没装开发包。

怎么办：装 `qt6-base-dev`（Debian 系）或 `qt6-qtbase-devel`（Fedora）。装完确认一下：

```bash
ls /usr/lib/x86_64-linux-gnu/cmake | grep Qt6
```

### 链接阶段报一堆找不到的符号

现象：`undefined reference to 'pthread_...'`、`'dlopen'`、`'sin'` 之类。

原因：`ui/CMakeLists.txt` 里那三个系统库（`pthread`、`dl`、`m`）是 Rust 标准库要的，缺一个就报这个。

怎么办：确认链接段没被改动过。在 macOS 或 Windows 上构建时这几个库名本来就不对，见[其他平台的构建](build-ui-other-platforms.md)。

### 报一堆找不到 `vtable` 的错

现象：`undefined reference to 'vtable for MainWindow'`。

原因：`AUTOMOC` 没生效，带 `Q_OBJECT` 的类没有被 moc 处理。

怎么办：确认 `CMakeLists.txt` 里有 `set(CMAKE_AUTOMOC ON)`，然后删掉构建目录重新配置。加了新的 `Q_OBJECT` 类之后也要重新配置一次，光 `cmake --build` 有时候不够。

### 换了目录位置之后构建失败

现象：CMake 里报的路径指向一个已经不存在的位置。

原因：CMake 的缓存里记着绝对路径。

怎么办：

```bash
rm -rf ui/build
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Release
```

## 启动阶段

### 弹「版本不匹配」然后退出

现象：启动时弹一个对话框说「头文件是第 N 版，库里是第 M 版」，程序退出，退出码 1。

原因：链接的静态库和头文件不是同一版。多半是改了 C ABI 的签名之后忘了重新构建静态库。

怎么办：

```bash
cargo build --release -p ysu-capi
cmake --build ui/build -j
```

这个弹窗是**故意**的。参数错位的调用在 C 的调用约定下不会报错，只会让被调方把数据指针当成函数指针用，一打开网页立刻崩，而且崩得没有线索。宁可启动时明确退出。

### 窗口起不来，报找不到适配器

现象：终端里说找不到 Vulkan 适配器，或者程序直接退出。

原因：没有 Vulkan 驱动，或者跑在没有图形会话的环境里。

怎么办：装 `mesa-vulkan-drivers`。检查一下有没有设备：

```bash
vulkaninfo | head -20
```

在没有显示的环境里（纯 SSH、没有 `DISPLAY`）跑不起来，那是正常的。

### 窗口能起，画面全白

原因有几种，从最可能的排起。

第一，页面真的没内容。换个确定有内容的地址试试。

第二，渲染失败但保留了上一帧的画面。看看终端有没有错误输出。

第三，外部样式表还没取回来。一份页面引三份样式表时，你会看到它先按无样式出现然后逐步变化——这是设计如此，等一两秒就好。

## 使用阶段

### 页面点不动

现象：点链接没反应，鼠标移上去光标也不变手型。

可能的原因：命中的地方不是链接。内核的命中测试要求点的位置正好压在文字片段上，点在链接文字左边的空白处不算。

### 页面排版明显不对

先看[已知限制](../ysu/known-limitations.md)。有几种情况是已知的：用了 `float` 或 `position: absolute` 的版式会按常规流排；表格用了 `colspan` 或 `rowspan` 会错位；图片不占位。这些不是 bug，是还没实现。

### 中文输不进地址栏

地址栏是 Qt 的 `QLineEdit`，输入法走 Qt 的插件。

怎么办：装 `fcitx5-qt` 或 `ibus-qt` 之类的包，重启程序。

### 状态栏一直停在「正在加载」

**这一条是真实存在的边界情况，值得单独说。**

`ysu_fetch` 在收到的 URL 为空指针或者不是合法 UTF-8 的时候，只写内部错误槽就返回，**不调用回调**。外壳在等待回调，于是加载计数不会回退，状态栏就停在那里。

触发条件很窄（地址栏里输的东西要恰好走到这一步），但知道有这回事比不知道强。见 [C ABI 的线程模型](../capi/threading.md)里的相关说明。

### 键盘按了没反应

`Alt+←` / `Alt+→` 在部分窗口管理器上会被抢走。换个 WM 设置或者用工具栏按钮。

`Ctrl+Tab` 在只有一个标签页时不动，那是有意的。

## 内核开发时

### 改了内核，外壳里看不到变化

`ysu-capi` 是静态库，CMake 未必知道它换过了。重新配置一次：

```bash
cargo build --release -p ysu-capi
cmake -S ui -B ui/build -DCMAKE_BUILD_TYPE=Release
cmake --build ui/build -j
```

### 想在不打开窗口的情况下看渲染结果

用两个例子，它们走的是和外壳完全相同的 C ABI：

```bash
cargo run -p ysu-capi --example dump_frame -- /tmp/frame.ppm 1.0 home 200
cargo run -p ysu-capi --example fetch_render -- https://example.com/ /tmp/out.ppm
```

排查渲染问题优先用这两条，比反复开窗口猜要快。输出是 PPM，多数图片查看器直接认。
