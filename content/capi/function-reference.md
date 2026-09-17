# 函数参考

26 个导出函数，按用途分组。所有签名取自 `ui/include/ysu_capi.hpp`。

约定符号：`→ *` 表示失败返回空指针，原因在 `ysu_last_error()`；`→ 需释放` 表示返回的字符串要用 `ysu_string_free()` 释放。

---

## 版本

### `uint32_t ysu_capi_version(void)`

C ABI 的接口版本。当前是 **2**。只在函数签名变化时递增。

外壳启动时拿它和头文件里的 `YSU_CAPI_VERSION` 比对，不一致就退出。

### `const char *ysu_engine_version(void)`

产品版本号，形如 `0.1.0`，来自仓库根的 `version.toml`。

返回**静态字符串，不需要也不能释放**。

---

## 错误与内存

### `char *ysu_last_error(void)` → 需释放

最近一次失败的原因。**取完清空**，再取一次会返回空指针。

在没有错误的时候返回空指针。

这是一个全局槽，不是每个引擎一份。多线程同时用多个引擎时，错误信息会互相覆盖。

### `void ysu_string_free(char *text)`

释放本库返还的字符串。传空指针是安全的，什么也不做。

**不要**用它释放 `ysu_engine_version()` 的返回值——那是静态的。

---

## 实例

### `YsuEngine *ysu_engine_new(uint32_t width, uint32_t height, double scale)` → *

建一个内核实例。`width` / `height` 是**逻辑像素**，`scale` 是设备像素比（普通屏 1.0，2 倍屏 2.0）。

渲染目标按逻辑尺寸乘像素比来建，所以高分屏上字形是按物理像素栅格化的。传物理尺寸当视口是错的：页面会按物理宽度排版，文字偏小。

内部会建 GPU 设备、渲染目标、字形图集与管线。这一步不便宜，别在滚动路径上反复建实例。

### `void ysu_engine_free(YsuEngine *engine)`

释放实例。传空指针是安全的。

调完之后所有由它返回的指针都失效，包括像素缓冲和标题字符串。

---

## 加载

### `void ysu_engine_load_html(YsuEngine *engine, const char *html, const char *base_url)`

加载一段 HTML。`base_url` 用来补全页面里的相对地址，**可以为空**（传 `NULL`）。

`html` 必须是以 NUL 结尾的合法 UTF-8。它会被解析成一棵新的文档树，之前的文档连同它引用的样式表一起丢掉。

### `bool ysu_engine_load_file(YsuEngine *engine, const char *path)`

从磁盘读一个文件并加载，字符集自动嗅探。成功返回 `true`。

失败时返回 `false`，原因在 `ysu_last_error()`。文件不存在、路径是目录、没有读权限、是二进制文件、超出大小上限，都走这一条。

---

## 视口与缩放

### `void ysu_engine_set_viewport(YsuEngine *engine, uint32_t width, uint32_t height, double scale)`

换视口尺寸，会重新排版。三个参数的口径同 `ysu_engine_new`。

参数没有变化时直接返回，不重排。这一点对性能有意义：窗口大小不变的重绘不会触发重新布局。

**注意**：视口变化会重新分配像素缓冲，之前从 `ysu_engine_render` 拿到的指针因此失效。

### `void ysu_engine_set_zoom(YsuEngine *engine, double zoom)`

换缩放倍数，会重新排版。

内部把值夹在 **0.25 到 5.0** 之间，传超出范围的值会被夹住，不报错。

缩放改的是布局视口宽度——页面按新宽度重排，不是把画好的画面拉伸。

---

## 查询

### `double ysu_engine_document_height(YsuEngine *engine)`

整页高度，**逻辑像素**。用来算滚动范围。

### `char *ysu_engine_title(YsuEngine *engine)` → * 需释放

页面标题。没有 `<title>` 时返回空字符串还是空指针取决于实现，两者都要能处理。

### `char *ysu_engine_link_at(YsuEngine *engine, double x, double y)` → 需释放

命中测试：取该点元素上的链接地址，没落在链接上返回空指针。

坐标是**布局坐标**，与 `ysu_engine_render` 的滚动位置同一套。外壳拿来的是部件坐标，要自己加上滚动位置、除以缩放倍数。

点在链接文字左边的空白处不算命中——判据是「这个点上压着哪个文字片段」。

---

## 渲染

### `const uint8_t *ysu_engine_render(YsuEngine *engine, double scroll_x, double scroll_y)` → *

把视口内容画出来，返回 RGBA 像素首地址。失败返回空指针。

`scroll_x` / `scroll_y` 是**布局坐标**，不是屏幕像素——缩放由内核换算。

返回的图像是**物理像素**，尺寸用 `ysu_image_*` 取。

**这块内存由引擎持有**，下一次 `ysu_engine_render` **或者** `ysu_engine_set_viewport` 之前有效。想留着就自己拷一份。

渲染失败时返回空指针，但缓冲里还留着上一次的画面。外壳据此保留上一帧，而不是把屏幕清空。

### `bool ysu_last_render_ok(YsuEngine *engine)`

上一次渲染是否成功。和 `ysu_engine_render` 的返回值有点重叠，单独一个函数是为了「渲染返回了指针但结果不可信」这类情况。

### `uint32_t ysu_image_width(YsuEngine *engine)`
### `uint32_t ysu_image_height(YsuEngine *engine)`
### `uint32_t ysu_image_stride(YsuEngine *engine)`

图像宽、高、每行字节数，都是物理像素。`stride` 恒等于 `width * 4`——缓冲是紧凑的，没有行填充。

**没有释放像素缓冲的函数。** 它不属于调用方。

---

## 外部样式表

内核不取样式表，它只告诉外壳有哪些要取。

### `char *ysu_engine_stylesheet_links(YsuEngine *engine)` → 需释放

页面里引用的外部样式表地址，每行一个，以 `\n` 分隔。没有时返回空指针。

加载完 HTML 之后调用一次，然后逐个去取。

### `void ysu_engine_set_linked_stylesheet(YsuEngine *engine, const char *url, const char *css)`

收下一份外部样式表并重新排版。

`url` 要跟 `ysu_engine_stylesheet_links` 给出的地址对得上；不在那个列表里的会被忽略。

一次传一份就重排一次。一份页面引三份样式表时，你会看到画面逐步变化——这是设计如此。

---

## 网络

### `void ysu_fetch(const char *url, bool as_page, YsuFetchCallback callback, void *userdata)`

异步取回一个地址，取完调用 `callback`。只支持 `http` 与 `https`。

`as_page` 决定要不要按网页要求：为真时内容类型必须是 HTML，取样式表时传假。取网页与取样式表不能共用同一个判据——CSS 的 `Content-Type` 是 `text/css`。

```c
typedef void (*YsuFetchCallback)(void *userdata, const char *url,
                                 const char *html, const char *error);
```

成功时 `html != NULL` 且 `error == NULL`；失败时反过来。

**回调在后台线程上执行。** 调用方自己负责切回界面线程。`callback` 是裸函数指针，传空指针是未定义行为。

`userdata` 由调用方分配、调用方释放，必须在回调返回之前保持有效。

没有取消接口。

---

## 内置页面

这三个函数返回完整的 HTML 文本，交给 `ysu_engine_load_html` 就是。

### `char *ysu_page_for(const char *url)` → 需释放

取内置页面。认 `about:home`、`about:blank`、`about:help`；认不出来时给起始页。

`about:` 后面写别的之所以不返回错误页，是因为白屏会让人以为浏览器坏了。

### `char *ysu_page_loading(const char *url)` → 需释放

加载中的占位页。网络取回期间显示它。

### `char *ysu_page_error(const char *url, const char *reason, bool local)` → 需释放

加载失败的说明页。`local` 为真时按「打不开这个文件」来写，否则按网络错误写。

---

## 地址

### `char *ysu_resolve_address(const char *input, int32_t *kind)` → * 需释放

把地址栏里的一行输入解析成规范地址，`kind` 写回类型：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `YSU_TARGET_INTERNAL` | 0 | 内置页面，地址交给 `ysu_page_for` |
| `YSU_TARGET_FILE` | 1 | 本地文件，交给 `ysu_engine_load_file` |
| `YSU_TARGET_REMOTE` | 2 | 网络地址，交给 `ysu_fetch` |

解析不出来时返回空指针，原因在 `ysu_last_error()`。空输入解析成起始页。

`kind` 必须是非空指针。

### `char *ysu_resolve_link(const char *base, const char *href)` → 需释放

按页面地址补全一个相对链接。`base` 是当前文档地址，可以为空。

`href` 为空或者以 `#` 开头时原样返回。`base` 不合法时回退成原 `href`。
