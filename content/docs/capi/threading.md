---
title: "线程模型"
description: "两条规则，都不难，违反了很难查。"
---

两条规则，都不难，违反了很难查。

## 规则一：引擎函数只在创建它的那条线程上调用

所有 `ysu_engine_*` 函数都必须从 `ysu_engine_new` 所在的那条线程调用。包括查询类的函数——`ysu_engine_document_height` 也算。

原因在底下：引擎内部持有 wgpu 的设备与队列，wgpu 设备不跨线程共享。这不是可以绕过的限制，是 GPU API 的性质。

**代码里没有任何运行时检查。** `YsuEngine` 在 Rust 侧不是 `Send` / `Sync`，但一旦变成 C 指针，这层保护就没了。C 编译器也看不见。所以这条规则靠调用方自律。

实际的约束是：外壳的界面线程建引擎，界面线程用它。

## 规则二：`ysu_fetch` 的回调在后台线程上执行

这是唯一的例外，也是唯一一处跨线程。

```c
void ysu_fetch(const char *url, bool as_page, YsuFetchCallback callback, void *userdata);
```

每次调用起一条新线程：在那条线程上建连接、取内容、然后**在那条线程上调用回调**。

也就是说回调函数体里：

**不能碰界面。** 任何 GUI 工具包都要求界面对象只在界面线程上访问。Qt 会直接崩或者在调试模式下报 `QObject: Cannot create children for a parent that is in a different thread`。

**不能碰引擎。** 回调里调 `ysu_engine_load_html` 是违规的——见规则一。

**可以碰 `userdata`。** 那是调用方自己的内存，但要注意它必须活到回调返回。

### 外壳是怎么处理的

`ui/src/main_window.cpp` 里的回调是个静态自由函数，它只做一件事：把 C 字符串拷成 Qt 的 `QString`，然后用队列连接投回界面线程。

```cpp
static void onFetched(void *userdata, const char *url, const char *payload, const char *error) {
    auto *request = static_cast<FetchRequest *>(userdata);
    const QString urlText = QString::fromUtf8(url != nullptr ? url : "");
    const QString bodyText = QString::fromUtf8(payload != nullptr ? payload : "");
    const QString errorText = error != nullptr ? QString::fromUtf8(error) : QString();

    QMetaObject::invokeMethod(
        request->window,
        [request, urlText, bodyText, errorText] {
            if (request->window != nullptr) {
                request->window->finishFetch(request, urlText, bodyText, errorText);
            }
            delete request;
        },
        Qt::QueuedConnection);
}
```

三个细节值得抄：

**先拷贝。** C 字符串在回调返回之后就没人保证了，所以在后台线程上就把它变成 `QString`（`QString` 是隐式共享的，拷贝便宜）。

**用 `Qt::QueuedConnection`。** 默认的自动连接在这种情况下也会选队列连接（跨线程），但显式写出来读代码的人就不用推断了。

**用 `QPointer` 做弱引用。** 请求发出后用户可能把标签页关了。`QPointer<MainWindow>` 和 `QPointer<BrowserTab>` 在对象销毁时会自动置空，lambda 里判一下就知道目标还在不在。

### 没有取消接口

`ysu_fetch` 没有对应的 `ysu_fetch_cancel`。发起之后没法叫停，只能等它自己结束。

外壳靠弱引用实现「逻辑上的取消」：标签页关掉之后，投回界面线程的 lambda 发现 `request->tab` 是空的，就把结果丢掉。

代价是网络请求还在跑、还在占带宽。超时是 20 秒，所以最多浪费 20 秒。

### 一个需要知道的边界情况

`ysu_fetch` 在 `url` 为空指针或者不是合法 UTF-8 的时候，**只写错误槽就返回，不调用回调**。

调用方如果按「一定会回调」来写，就会永远等下去。外壳的表现是状态栏卡在「正在加载」，因为加载计数加了没减。

同样在这条早退路径上，调用方为 `userdata` 分配的内存没人释放。

契约层面能说的是：**`ysu_fetch` 不保证一定回调**。稳妥的写法是在调用之前就校验 URL，而不是指望回调来收尾。

## 错误槽是全局的

`ysu_last_error` 背后是一个全局 `Mutex<Option<String>>`。多线程同时用多个引擎时，错误信息会互相覆盖。

单线程用法（外壳现在的用法）没问题。

## panic 会直接终止进程

release 档 `panic = "abort"`。内核里一旦 panic，进程直接停，不尝试跨 FFI 展开。

对嵌入方来说这意味着：内核崩了不会给你一个错误码，是进程没了。想提高健壮性的话得自己加一层进程隔离（现在没有）。

## 并发能到哪一步

现在的模型是**一个引擎实例绑一条线程**。多个标签页各有各的引擎，但都在界面线程上——渲染是串行的，一次画一个标签页。

要让渲染并行，需要的东西比想象中多：每个引擎一份错误槽、线程池、以及一套「哪些状态可以跨线程读」的约定。现在都没有。
