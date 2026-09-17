# 文本排版

字形整形与断行交给 cosmic-text；行怎么切、行高怎么算、对齐怎么做由内核决定。`text.rs` 有 13 条单元测试。

## 分工

```rust
//! 文本排版：字形整形与断行交给 cosmic-text，行切分与行高由本模块算。
```

这条分工是清醒的：字形整形要处理连字、组合字符、双向文本、字体回退，是几十年积累的活；行切分与行高是布局规则，属于内核。

## 入口

```rust
impl TextMeasurer {
    pub fn layout(&mut self, text: &str, style: &TextStyle, max_width: Option<f32>) -> TextLayout;
    pub fn measure_width(&mut self, text: &str, style: &TextStyle) -> f32;
}
```

`layout` 做整形加断行，返回带有行信息的结果。`measure_width` 只量宽度不断行。

`max_width` 传 `None` 表示不折行。

## 样式

```rust
pub struct TextStyle {
    /* 字体族、字号、字重、斜体、行高、折行方式 */
}
```

六项：字体族、字号、字重、是否斜体、行高、是否折行。

**没有字距、词距、大小写转换、连字符、`font-variant`、`font-stretch`。** 想加这些属性，先得给 `TextStyle` 加字段。

## 整形配置

```rust
use cosmic_text::{Attrs, Buffer, Family, FontSystem, Metrics, Shaping, Style, Weight, Wrap};
```

用到的配置：

```rust
Metrics::new(font_size, line_height)
buffer.set_size(max_width.or(Some(f32::MAX)), None)
Wrap::WordOrGlyph   // 或 Wrap::None
Shaping::Advanced   // 高级整形，处理连字与复杂文字
```

`Wrap::WordOrGlyph` 是「优先在词边界断，词太长就按字形断」。`Wrap::None` 用于 `white-space: nowrap`。

`Shaping::Advanced` 会做连字替换、字距调整、复杂文字的重新排序——比简单整形慢，但对拉丁文以外的文字是必须的。

## 字体族映射

```rust
fn primary_family(...) -> Option<Family>;
```

| CSS 写法 | 映射 |
| --- | --- |
| `serif` | `Family::Serif` |
| `sans-serif` | `Family::SansSerif` |
| `monospace` | `Family::Monospace` |
| `cursive` | `Family::Cursive` |
| `fantasy` | `Family::Fantasy` |
| `system-ui` / `-apple-system` | `Family::SansSerif` |
| 其它 | 按名字查，找不到交给 cosmic-text 的默认回退 |

`font-family: A, B, sans-serif` 按优先级逐个试。

## 行信息

```rust
pub struct TextLine {
    pub text: String,
    pub raw_len: usize,
    pub width: f64,
    pub top: f64,
    pub height: f64,
    pub baseline: f64,
}
```

`raw_len` 是个细节但值得说：整形器会吃掉行尾的换行符，所以行文本的长度和原文里那一段的长度不一定相等。`raw_len` 记的是**原文里被这一行消费掉的字节数**，用来在原文上正确地推进。没有它的话，含换行的段落会被重复切分。

## 行高

`Metrics::new(font_size, line_height)` 里的 `line_height` 是行高的绝对值（`font_size × line_height 倍数`）。

**基线是估算的**：

```
baseline_offset = height * 0.8
```

0.8 是个经验值——西文字体的基线大约在字身框高度的 80% 处。真实的基线要从字体的 `OS/2` 表或 `hhea` 表里读，cosmic-text 提供得到，现在没有用。

后果是：`vertical-align` 相关的对齐（`sup` / `sub` 的抬高、表格单元格的垂直居中、行内块与文字的对齐）精度都受限。而且在中文与西文混排时这个估算会偏——两者的基线位置不一样。

## 断行的实现

```rust
pub fn text(&mut self) -> &str;
pub fn layout(&mut self, text: &str, style: &TextStyle, max_width: Option<f32>) -> TextLayout;
```

`flow_text` 那一层做的是「只在当前行非空时逐行拼接」。这不是微优化——一个长段落如果每行都重新整形一遍整段文本，代价是平方级的。

代码注释里专门写了这一条。改这块的时候留意。

## 断行与换行的控制

| 属性 | 状态 |
| --- | --- |
| `white-space` | ✅ 五种取值都支持 |
| `text-align` | ✅ left / right / center，justify 是空操作 |
| `line-height` | ⚠️ 只吃无单位倍数与 `normal`，`line-height: 20px` 被静默忽略 |
| `word-break` | ❌ 无 |
| `overflow-wrap` | ❌ 无 |
| `hyphens` | ❌ 无 |
| `letter-spacing` / `word-spacing` | ❌ 无 |
| `text-transform` | ❌ 无 |
| `text-indent` | ❌ 无 |
| `text-overflow`（省略号） | ❌ 无，全仓零命中 |

**省略号完全没有实现。** 这在真实页面上影响不小——单行截断加省略号是列表、卡片、标签里极常见的写法，现在会直接溢出或者被裁掉。

**`@font-face` 声明会被解析进字体表，但没有消费方。** 字体文件既没下载也没注册到整形器，所以声明了自定义字体的页面用的还是回退字体。

## 下划线

`text-decoration: underline` 解析成 `ComputedStyle::underline`（一个布尔），随绘制命令传到渲染器，由渲染器画成一条矩形。

`overline`、`line-through`、`blink` 以及下划线的颜色、样式、粗细都没有。

## 性能

**整形没有缓存。** 同一段文字每次重绘都会重新整形一遍。

触发条件是「每次重绘」而不是「每帧」——渲染是按需的，空闲时一次整形都不做。所以空闲状态下没有代价，滚动时每帧都要重来。

最贵的重复整形在浏览器界面自己的标题截断里（逐字符反复度量），那部分在外壳，不在内核。

## 测试

13 条，覆盖行切分的准确性（含换行符的处理与 `raw_len`）、对齐的三种取值、空白规则与断行的组合、`measure_width` 与 `layout` 结果的一致性、以及空文本与纯空白文本的边界。
