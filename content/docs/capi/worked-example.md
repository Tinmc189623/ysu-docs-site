---
title: "完整示例"
description: "从建实例到画出一帧的完整流程，包含外部样式表的取回。代码是可以直接编译的 C++。"
---

从建实例到画出一帧的完整流程，包含外部样式表的取回。代码是可以直接编译的 C++。

## 构建配置

CMake 里链接静态库和它需要的系统库：

```cmake
cmake_minimum_required(VERSION 3.16)
project(ysu-demo LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(demo main.cpp)
target_include_directories(demo PRIVATE /path/to/Vexo/ui/include)

target_link_libraries(demo PRIVATE
    /path/to/Vexo/target/release/libysu_capi.a
    pthread dl m
)
```

手动编译也行：

```bash
c++ -std=c++17 -I/path/to/Vexo/ui/include \
    main.cpp /path/to/Vexo/target/release/libysu_capi.a \
    -lpthread -ldl -lm -o demo
```

## 代码

```cpp
// 把 YSU 当库用的最小示例：取一个网址、画一帧、存成 PPM。
//
// 这个程序和 ui/ 那套外壳走的是同一条路径，只是外壳把像素贴到 Qt 部件上，
// 这里把它写进文件。

#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <mutex>
#include <condition_variable>

extern "C" {
#include "ysu_capi.hpp"
}

// 等待取回结果用的信箱。回调在后台线程上执行，所以这里要加锁。
struct FetchBox {
    std::mutex mutex;
    std::condition_variable done;
    bool finished = false;
    std::string url;
    std::string body;
    std::string error;
};

// 取回完成的回调。运行在后台线程上，只碰 FetchBox，不碰引擎也不碰别的。
static void on_fetched(void *userdata, const char *url, const char *body, const char *error) {
    auto *box = static_cast<FetchBox *>(userdata);
    std::lock_guard<std::mutex> lock(box->mutex);
    box->url = url != nullptr ? url : "";
    box->body = body != nullptr ? body : "";
    box->error = error != nullptr ? error : "";
    box->finished = true;
    box->done.notify_one();
}

// 同步取回一份资源，最多等 30 秒。返回是否成功。
static bool fetch_blocking(const std::string &url, bool as_page, std::string &out) {
    FetchBox box;
    ysu_fetch(url.c_str(), as_page, on_fetched, &box);

    std::unique_lock<std::mutex> lock(box.mutex);
    if (!box.done.wait_for(lock, std::chrono::seconds(30), [&] { return box.finished; })) {
        return false;
    }
    if (!box.error.empty()) {
        std::fprintf(stderr, "取回失败 %s：%s\n", url.c_str(), box.error.c_str());
        return false;
    }
    out = box.body;
    return true;
}

// 把渲染结果写成 PPM。PPM 的写法和它的格式一样简单：头部三行加裸像素。
static bool write_ppm(const char *path, const uint8_t *pixels, uint32_t width, uint32_t height) {
    std::FILE *file = std::fopen(path, "wb");
    if (file == nullptr) {
        return false;
    }
    std::fprintf(file, "P6\n%u %u\n255\n", width, height);
    // PPM 是 RGB 三通道，内核给的是 RGBA，写的时候要丢掉 alpha。
    for (uint32_t i = 0; i < width * height; ++i) {
        const uint8_t rgb[3] = {pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]};
        std::fwrite(rgb, 1, 3, file);
    }
    std::fclose(file);
    return true;
}

// 打印内核错误槽里的内容。错误信息取一次就清空。
static void report_error(const char *what) {
    char *reason = ysu_last_error();
    std::fprintf(stderr, "%s：%s\n", what, reason != nullptr ? reason : "（没有说明）");
    if (reason != nullptr) {
        ysu_string_free(reason);
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        std::fprintf(stderr, "用法：%s <网址> <输出.ppm>\n", argv[0]);
        return 1;
    }
    const std::string url = argv[1];
    const char *output = argv[2];

    // 1. 建实例。1280x800 是逻辑像素，1.0 是设备像素比。
    YsuEngine *engine = ysu_engine_new(1280, 800, 1.0);
    if (engine == nullptr) {
        report_error("建实例失败");
        return 1;
    }

    // 2. 取页面。
    std::string html;
    if (!fetch_blocking(url, /*as_page=*/true, html)) {
        ysu_engine_free(engine);
        return 1;
    }

    // 3. 交给内核解析、排版。基准地址用取回后的最终地址，跟随重定向之后才准。
    ysu_engine_load_html(engine, html.c_str(), url.c_str());

    // 4. 取页面引用的外部样式表，一份一份交回去。
    //
    //    这一步不能省。少了它，页面会按无样式排出，看着像排版坏了。
    char *links = ysu_engine_stylesheet_links(engine);
    if (links != nullptr) {
        std::string list(links);
        ysu_string_free(links);

        std::size_t start = 0;
        while (start < list.size()) {
            const std::size_t end = list.find('\n', start);
            const std::string href = list.substr(start, end == std::string::npos ? end : end - start);
            if (!href.empty()) {
                // 页面里的地址可能是相对的，按文档地址补全。
                char *absolute = ysu_resolve_link(url.c_str(), href.c_str());
                if (absolute != nullptr) {
                    std::string css;
                    if (fetch_blocking(absolute, /*as_page=*/false, css)) {
                        ysu_engine_set_linked_stylesheet(engine, absolute, css.c_str());
                    }
                    ysu_string_free(absolute);
                }
            }
            if (end == std::string::npos) {
                break;
            }
            start = end + 1;
        }
    }

    // 5. 画一帧。滚动位置是布局坐标，这里是页面顶部。
    const uint8_t *pixels = ysu_engine_render(engine, 0.0, 0.0);
    if (pixels == nullptr) {
        report_error("渲染失败");
        ysu_engine_free(engine);
        return 1;
    }

    // 6. 取图像尺寸并写文件。注意这块内存在下一次渲染之前有效，这里立刻用掉。
    const uint32_t width = ysu_image_width(engine);
    const uint32_t height = ysu_image_height(engine);
    if (!write_ppm(output, pixels, width, height)) {
        std::fprintf(stderr, "写不了 %s\n", output);
        ysu_engine_free(engine);
        return 1;
    }
    std::printf("已写出 %s（%ux%u）\n", output, width, height);

    // 顺便打一下页面高度，用来看滚动范围。
    std::printf("整页高度 %.0f 逻辑像素\n", ysu_engine_document_height(engine));

    ysu_engine_free(engine);
    return 0;
}
```

还需要 `#include <chrono>` 才能用 `std::chrono::seconds`。

## 几个容易写错的地方

**第 3 步的基准地址。** 基准地址要传**取回之后的最终地址**。如果原地址被 301 跳转过，页面里的相对链接要按最终地址补全，不是按初始地址。`ysu_fetch` 会把跟随重定向后的地址回传给回调——上面的例子为了简短，直接用输入地址，真实场景应该用回调里那个 `url`。

**第 4 步不能省。** 内核不取样式表，它只告诉你有哪几份。少了这一步，页面按无样式渲染。

**`as_page` 参数。** 取网页传 `true`，取样式表传 `false`。传错的话会被内容类型检查拦下——CSS 的 `Content-Type` 是 `text/css`，按网页的要求它不合格。

**第 5 步的坐标。** 滚动位置是布局坐标。如果上面按 2.0 的像素比建实例、又想把滚动位置定在 400 个屏幕像素处，这里要传 `400 / zoom`，不是 400。

**第 6 步的时机。** `pixels` 在下一次渲染之前有效。在这个例子里写文件立刻跟上，没问题。留在外面当缓存是错的。

## 编译运行

```bash
cargo build --release -p ysu-capi
c++ -std=c++17 -I ui/include main.cpp target/release/libysu_capi.a -lpthread -ldl -lm -o demo
./demo https://example.com/ /tmp/out.ppm
```

## 和仓库里的例子对照

`crates/ysu-capi/examples/` 下三个例子做的是同一件事，只是用 Rust 写的，直接调同一套 `extern "C"` 函数（`ysu-capi` 同时产出 rlib）：

| 例子 | 做什么 |
| --- | --- |
| `fetch.rs` | 最小异步取回验证 |
| `dump_frame.rs` | 把内置对照页渲染成图片，不联网 |
| `fetch_render.rs` | 完整走一遍取页面、取样式表、应用、渲染 |

`fetch_render.rs` 是上面这段 C++ 的 Rust 版本，对照着看能确认两种写法在做什么上是等价的。
