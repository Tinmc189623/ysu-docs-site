# 内存与所有权

C 里没有所有权，所以每一样东西由谁分配、由谁释放、能留多久，都得写死成约定。

## 一张表

| 东西 | 谁分配 | 谁释放 | 能留多久 |
| --- | --- | --- | --- |
| `YsuEngine *` | `ysu_engine_new` | 调用方 `ysu_engine_free` | 直到释放 |
| 返还的字符串（`char *`） | 内核 | 调用方 `ysu_string_free` | 直到释放 |
| 像素缓冲（`const uint8_t *`） | 内核 | **调用方不能释放** | 下一次渲染或改视口之前 |
| 传入的字符串（`const char *`） | 调用方 | 调用方 | 调用期间 |
| `ysu_fetch` 的 `userdata` | 调用方 | 调用方 | 回调返回之前 |
| `ysu_engine_version()` 的返回值 | 静态 | **不能释放** | 程序整个生命周期 |

## 需要释放的字符串

**9 个**函数返回需要释放的字符串：

```
ysu_last_error
ysu_engine_title
ysu_engine_link_at
ysu_engine_stylesheet_links
ysu_page_for
ysu_page_loading
ysu_page_error
ysu_resolve_address
ysu_resolve_link
```

统一用 `ysu_string_free` 释放。它内部把指针还原成 Rust 的 `CString` 再交回给分配器，所以**不能**用 `free()` 释放，也不能用别的分配器。

`ysu_string_free(NULL)` 是安全的，什么也不做。

**不需要释放的**：`ysu_engine_version()`。它返回一个指向静态 `CString` 的指针，程序活着它就活着。释放它会造成未定义行为。

## 像素缓冲

这块最容易出错，单独说。

```c
const uint8_t *pixels = ysu_engine_render(engine, 0.0, 0.0);
```

`pixels` 指向引擎内部的一块内存，不是你拿到的一份拷贝。它有三个特性：

**不是你释放的。** 没有任何 `ysu_image_free`——正确用法就是不管它。

**会被原地覆盖。** 下一次 `ysu_engine_render` 会往同一块内存写。想留着必须自己 `memcpy` 出来。

**改视口也会让它失效。** 这一条超出了头文件里写的范围。头文件说「下一次 `ysu_engine_render` 之前有效」，实现上 `ysu_engine_set_viewport` 会重新分配这块缓冲（尺寸变了），旧指针随即悬空。稳妥的写法是：拿到指针就尽快用掉，或者拷一份。

缓冲是紧凑的，`ysu_image_stride` 恒等于 `ysu_image_width * 4`，没有行填充。内核内部读回 GPU 纹理时确实有 256 字节的行对齐填充，但那是内部缓冲的事，拷进对外缓冲时逐行剥掉了。

### 一个正确的外壳写法

Qt 的 `QImage` 可以直接包住外部内存，不拷贝：

```cpp
const uint8_t *pixels = ysu_engine_render(engine_, scroll_.x() / zoom_, scroll_.y() / zoom_);
if (pixels == nullptr) {
    return;  // 保留上一帧
}
QImage frame(pixels,
             ysu_image_width(engine_),
             ysu_image_height(engine_),
             ysu_image_stride(engine_),
             QImage::Format_RGBA8888);
frame.setDevicePixelRatio(devicePixelRatioF());
painter.drawImage(rect(), frame);
```

关键是 `frame` 必须在这一次 `paintEvent` 里用完。把它存成成员变量留到下一次重绘，就是在用一块已经被覆盖的内存。

`ysu_engine_render` 返回空指针表示渲染失败，但缓冲里还留着上一帧的内容。这时候直接返回、不清屏，画面上就是上一帧——比闪一下白屏好。

## 传入的字符串

所有 `const char *` 入参都是**只借不拿**：内核用 `CStr::from_ptr` 借用它们，读完就完，不会保存指针。

所以：

- 必须是以 NUL 结尾的合法 UTF-8（Rust 的 `CStr` 要求）
- 调用返回之后就可以立刻释放
- `base_url` 这类可选参数传 `NULL` 是允许的

`ysu_engine_load_html` 的 `html` 会被完整解析成文档树，解析完就不需要它了。

## 回调里的 userdata

`ysu_fetch` 的 `userdata` 是唯一一块「跨线程传递的调用方内存」。约定是：

- 由调用方分配
- 必须在**回调返回之前**保持有效
- 由调用方在回调里（或者投递到别的线程之后）释放

典型的写法是分配一个堆对象装请求上下文，回头在回调里删掉：

```c
struct FetchRequest {
    char url[512];
    /* ... */
};

void on_fetched(void *userdata, const char *url, const char *body, const char *error) {
    struct FetchRequest *req = userdata;
    /* 处理结果…… */
    free(req);
}
```

用栈上的变量当 `userdata` 是常见的错——回调在另一个线程上执行，那时候栈早没了。

## 空指针的行为

传空引擎指针给任何函数都不会崩，内核会写一条错误进错误槽然后返回。这是有意的：

```c
ysu_engine_render(NULL, 0.0, 0.0);   /* 返回 NULL，不崩 */
ysu_engine_free(NULL);               /* 什么都不做 */
```

但传空指针给**必须非空**的参数（比如 `ysu_engine_load_html` 的 `html`）就是未定义行为。契约是「可以不传的会写出来，没写的就是必须传」。

## 跨 FFI 不会展开

release 档开了 `panic = "abort"`。所以内核里一旦 panic，整个进程直接停，不会尝试沿着 C 的调用栈往回展开。

这是刻意的：跨 FFI 展开是未定义行为，静默地跨过去比直接停更危险。

## 错误信息是全局的

`ysu_last_error` 背后是一个全局的 `Mutex<Option<String>>`，不是每个引擎一份。

也就是说两个线程同时用两个引擎，一个线程取错误可能取到另一个线程写的。真正的多线程用法需要每个引擎一份错误槽，现在没有。

单线程用（也就是外壳现在的用法）没问题。
