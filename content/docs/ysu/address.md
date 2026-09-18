---
title: "地址与内置页面"
description: "「地址栏里输的是路径还是网址」「about: 开头的怎么处理」——这些看起来像界面问题，其实是网页平台的行为。它们在内核里，不在外壳里。"
---

「地址栏里输的是路径还是网址」「`about:` 开头的怎么处理」——这些看起来像界面问题，其实是网页平台的行为。它们在内核里，不在外壳里。

判据是：换一套外壳之后，这个判断还要重新做一遍吗？要，那它就该在内核里。外壳因此一行 HTML 都没有，地址判断也一行都没有。

## 地址解析

```rust
pub enum Target {
    Internal(String),
    File(String),
    Remote(String),
}

pub fn resolve_input(input: &str) -> /* ... */;
```

判断顺序：

1. **空串**，或者**以 `about:` 开头** → `Internal`
2. **看起来像路径** → `File`
3. 其余 → `Remote`

### 什么算路径

```rust
fn looks_like_path(input: &str) -> bool;
```

认六种前缀：

```
~
file://
/
./
../
~/
```

`~` 展开成家目录。展开失败（读不到 `HOME`）时报错。

**裸文件名不算路径。** `page.html` 会被当成主机名，补上 `http://` 去取。

这条是有意的，代码注释里写了原因：

```
//! 裸文件名不当路径：`example.com` 与 `index.html` 长得一样，按主机名处理
```

`example.com` 和 `index.html` 在字符串上没有任何可区分的特征——都有点、都有字母、都没有协议前缀。任何一种启发式规则（看后缀是不是 `html`？看有没有点？）都会误判另一半。定成按主机名处理之后，要打开当前目录下的文件就写 `./page.html`，规则简单、没有意外。

### `file://` 地址的构造

```rust
fn file_url_from_input(input: &str) -> /* ... */;
```

已经是 `file://` 开头就只做规范化；`~` 开头的先展开家目录；其余的用 `std::path::absolute` 转成绝对路径。

`std::path::absolute` 的好处是**它不碰文件系统**——只是把 `./a.html` 拼成 `/cwd/a.html`，不检查文件存不存在。于是「路径算出来了但文件不存在」和「路径本身就非法」这两类错误能分开报。

编码（空格、`#`、`?`、`%`、非 ASCII）交给 `url` crate 的 `from_file_path` 处理。

反方向有 `path_from_file_url`。

### 补全

```rust
fn normalize(input: &str) -> String;
```

含 `://` 的原样返回，否则补 `http://`。

```rust
pub fn resolve_link(base: &str, href: &str) -> String;
```

按当前文档地址补全一个相对链接。

空串与 `#anchor` 原样返回——`#` 开头的是页内锚点，不需要补全，也不需要导航。其余用 `Url::join`。`base` 不合法时回退成原 `href`。

没有「当成搜索词」这一档：搜索功能还没接。

## 内置页面

```rust
pub const HOME_URL: &str = "about:home";
pub const BLANK_URL: &str = "about:blank";
pub const HELP_URL: &str = "about:help";
```

五个页面：

| 页面 | 函数 | 用途 |
| --- | --- | --- |
| 起始页 | `home_page()` | 展示内核能力与可打开的地址写法 |
| 空白页 | `blank_page()` | 全白空文档 |
| 说明页 | `help_page()` | 列出全部内置地址 |
| 加载中 | `loading_page(url)` | 网络取回期间的占位 |
| 加载失败 | `error_page(url, message, local)` | 出错时的说明 |

```rust
pub fn is_internal(url: &str) -> bool;
pub fn resolve(url: &str) -> (String, String);
```

`is_internal` 认空串与 `about:` 开头的地址。

`resolve` 返回 `(内容, 规范地址)`。**认不出来的 `about:` 一律给起始页**：

```
/// 认不出来的 `about:` 地址一律给起始页，不返回空白——用户看见起始页至少
/// 知道浏览器还活着，白屏只会让人以为坏了。
```

这条取舍值得记：用户输错一个内置地址，得到一个空白页，第一反应是浏览器崩了。给一个有内容的页面，他就知道一切正常，只是地址不对。

### 为什么内置页面属于内核

它们和普通网页走**完全相同**的解析、层叠、排版与绘制流程——本来就是内核的产物。所以：

- 外壳不必拼 HTML 字符串（那是内核的活）
- 这些页面是整条链路最直接的自检：起始页渲染出来不对，说明内核有问题
- 换一套外壳不用重写这些页面

起始页上专门放了圆角、行内块、表格这些东西，就是当自检用的。

### 转义

```rust
fn escape(text: &str) -> String;
```

转义 `&`、`<`、`>`、`"` 四个字符。错误页要显示用户输入的地址与系统给的原因，两者都可能带尖括号——不转义的话一个含 `<` 的地址会把页面结构撑坏。

### 本地与远程的错误页

```rust
pub fn error_page(url: &str, message: &str, local: bool) -> String;
```

`local` 区分两类失败，文案不同：

- `local = true`：打不开这个文件
- `local = false`：无法访问此网站

区别是必要的——本地文件打不开时劝人去检查网络是错的。文件不存在、路径是目录、没有读权限、超出大小上限，这几类对用户来说都是「文件有问题」，网络那边另有原因。

## 测试

`address.rs` 12 条，覆盖六种路径前缀、`~` 展开、裸主机名补协议、相对链接补全、`#anchor` 的原样返回、以及各类非法输入的兜底。

`pages.rs` 8 条，覆盖三个内置地址的解析、认不出的 `about:` 落到起始页、`is_internal` 的判定、以及转义。

## C ABI 上的对应

| 内核函数 | C ABI |
| --- | --- |
| `address::resolve_input` | `ysu_resolve_address`（带 `kind` 出参） |
| `address::resolve_link` | `ysu_resolve_link` |
| `pages::resolve` | `ysu_page_for` |
| `pages::loading_page` | `ysu_page_loading` |
| `pages::error_page` | `ysu_page_error` |
