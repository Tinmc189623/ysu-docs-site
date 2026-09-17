---
title: "网络与字符集"
description: "手写的 HTTP/1.1 客户端加 rustls。没有第三方 HTTP 库——net/http.rs 的文件注释写着「只管字节层面的事」。42 条单元测试。"
---

手写的 HTTP/1.1 客户端加 rustls。没有第三方 HTTP 库——`net/http.rs` 的文件注释写着「只管字节层面的事」。42 条单元测试。

## 依赖

```toml
url.workspace = true
encoding_rs.workspace = true
rustls.workspace = true
webpki-roots.workspace = true
```

TLS 交给 rustls，根证书用 webpki-roots（内置的 Mozilla 根证书集）。HTTP 报文自己拼、自己解。URL 用 `url` crate，字符集解码用 `encoding_rs`。

## 方法

```rust
pub enum Method { Get, Post, Head }
```

三个都定义了，`Request::to_bytes` 会正确地序列化 `POST`（含 `Content-Length`），也有对应测试。

**但客户端只发 GET。** `fetch_once` 里写死 `Request::get(...)`，没有发出 POST 的路径。所以表单提交那类场景现在做不到。

## 连接

每次请求新建一条连接，发 `Connection: close`，取完就断。

```rust
//! 连接池留到有性能需求时再做。
```

一个页面引五份外部样式表，就是五条连接、五次 TLS 握手。慢，但正确。

同时开着 `set_nodelay(true)`——请求量小，延迟比吞吐重要。

## HTTPS

rustls 0.23 加 webpki-roots。连接时建 `RootCertStore`，用 `with_no_client_auth`，握手在 `connect` 里完成。

```rust
Stream::Tls(rustls::StreamOwned<ClientConnection, TcpStream>)
```

## 重定向

跟随 301、302、303、307、308。

`Location` 头用 `Url::join` 解析，因此相对地址（`/new-path`）能正确补全。跳转次数上限 10，超过报 `TooManyRedirects`。

303 的「把方法改成 GET」这条语义没有单独处理——因为本来就只用 GET。

跟随之后的最终地址会回传给调用方，这一点在 C ABI 那边是有用的：补全页面里的相对链接要用最终地址。

## 限额

| 项 | 值 | 用途 |
| --- | --- | --- |
| 超时 | 20 秒 | 防止对端拖着不放 |
| 响应体上限 | 16 MiB | 防止超大响应 |
| 响应头上限 | 64 KiB | 防止无限长的头 |
| 重定向次数 | 10 | 防止循环跳转 |

## 正文定界

优先级：`Transfer-Encoding: chunked` → `Content-Length` → 读到对端关闭。

204、304、1xx 按规范没有正文，直接当空处理。

**分块传输的完整性单独判断。** 有一个 `chunked_is_complete` 函数，判据是「收到过终止块」，不依赖服务器关闭连接。这是必要的：分块编码的响应可能一直保持连接打开（比如长轮询），靠关闭判断会把正常的响应当成截断。

## 不支持的

**压缩完全不支持。** 请求不发 `Accept-Encoding`，响应里的 `Content-Encoding` 也不解。全仓对 `gzip`、`brotli`、`deflate` 零命中。

后果是流量比主流浏览器大——HTML 的压缩比通常在 3 到 5 倍之间。

**Cookie 不支持。** 不存也不发。

**缓存不支持。** 没有条件请求，没有 `Cache-Control` 处理，刷新就是重新取。

**连接池没有。** 上面说了。

**子资源只取样式表。** `<link rel="stylesheet">` 会取，`<script>`、`<img>`、字体文件都不取。取样式表的机制是复用取页面的那条路，靠 `as_page` 参数区分判据。

## 字符集嗅探

```rust
pub fn sniff(bytes: &[u8], content_type: Option<&str>) -> /* ... */;
```

按 HTML 规范的顺序，三步：

**第一步，字节序标记。** EF BB BF 是 UTF-8，FF FE 是 UTF-16LE，FE FF 是 UTF-16BE。BOM 的优先级最高。

**第二步，`Content-Type` 头的 charset。** 形如 `text/html; charset=gbk`。解析时容忍引号（`charset="gbk"`）。

**第三步，正文前 1024 字节里的 `<meta charset>`。** 扫描是在 ASCII 上做的——遇到非 ASCII 字节先映射成 U+FFFD 再比，这样能避免在多字节序列中间误判。

三步都落空就用 UTF-8。

```rust
pub fn decode(bytes: &[u8], encoding: /* ... */) -> String;
```

实现在 `encoding_rs` 上，遇到非法字节做替换而不是 panic——一个编码声明写错的页面会显示成乱码加替换字符，但不会让浏览器崩掉。

编码名用 `Encoding::for_label` 识别，标签里只收字母、数字、减号、下划线。

## 已知的偏差

规范里 `@charset` 声明在样式表里也起编码作用。CSS 词法层产出了 `Charset` 记号，但**把它接进解码那一步还没做**。所以一份用 `@charset "gbk"` 声明编码的样式表，会按 BOM / `Content-Type` / UTF-8 的顺序解码，声明被忽略。

## 测试

42 条，分三个文件：

**`http.rs`（20 条）** 测报文的拼装与解析：请求行的构造、状态行与响应头的解析、`Content-Length` 与分块解码、各种畸形输入的处理。

**`client.rs`（10 条）** 测完整的请求流程。这些测试会**真的开一个本地 TCP 监听端口**，用一个假的服务器回预置的响应——所以它覆盖的是真实的解析路径，不是打桩的。

**`encoding.rs`（12 条）** 测嗅探的三种来源与优先级、`decode` 对非法字节的处理、以及编码名的识别。
