# HTML 词法

把一串字符切成记号。这一层按 WHATWG 的记号化状态机实现，39 条单元测试。

## 记号

```rust
pub enum Token {
    Doctype(Doctype),
    StartTag(Tag),
    EndTag(Tag),
    Comment(String),
    Cdata(String),
    Character(String),
    Eof,
}
```

七种。每个标签带名字、属性表、是否自闭合：

```rust
pub struct Tag {
    pub name: String,
    pub attributes: Vec<Attribute>,
    pub self_closing: bool,
}

pub struct Attribute {
    pub name: String,
    pub value: String,
}
```

DOCTYPE 带名字、公开标识、系统标识，以及一个 `force_quirks`：

```rust
pub struct Doctype {
    pub name: String,
    pub public_id: Option<String>,
    pub system_id: Option<String>,
    pub force_quirks: bool,
}
```

`force_quirks` 记的是「这个 DOCTYPE 写坏了，文档要进怪异模式」。这条信息一路传到树构建，因为盒模型在两种模式下不一样。

## 四种原始文本模式

标签的内容按什么规则扫描，取决于它是什么标签：

```rust
pub enum RawTextMode {
    Rcdata,      // 字符引用仍然生效，如 <title>、<textarea>
    Rawtext,     // 字符引用不生效，如 <style>、<xmp>
    ScriptData,  // 额外处理 <!-- 引起的转义状态
    Plaintext,   // 其后所有内容都是文本，如 <plaintext>
}
```

**Rcdata** 里 `&amp;` 会被解码成 `&`，因为它装的是给人看的文本。

**Rawtext** 里不解码，`<style>` 里的 `&` 就是 `&`。

**ScriptData** 要多处理一层：脚本里可能写着 `<!--`，后面还可能再来一个 `<script>`，规范为此定义了双重转义状态。处理不对的话，一段注释掉的脚本会把后面半个文档吃掉。

**Plaintext** 之后的整个文档都是文本，连 `</plaintext>` 都不会被认出来——这是规范规定的行为，不是实现省略。

词法器不知道当前该用哪种模式，它靠 `set_raw_text_mode` 接受指示：

```rust
pub fn set_raw_text_mode(&mut self, mode: RawTextMode, end_tag: &str);
```

该由谁指示？树构建。它知道当前在 `<title>` 里面还是 `<script>` 里面。

## CDATA 的两种处理

```rust
Cdata(String),
```

同一个记号在两种上下文里处理完全不同：

- 在**外来内容**（SVG 与 MathML）里，它是一段文本
- 在 **HTML 内容**里，它是一次解析错误，按注释收场

词法器不知道自己在哪种上下文里，所以原样交出去，让树构建判断。这个设计取舍值得记一下：把判断推到知道答案的那一层，而不是让词法器去猜。

## 字符引用

```rust
pub fn decode_character_references(text: &str) -> String;
```

给一段文本，把里面的 `&amp;`、`&#65;`、`&#x41;` 解成对应字符。细节见[字符引用](character-references.md)。

## 接口

```rust
impl<'a> Tokenizer<'a> {
    pub fn new(input: &'a str) -> Self;
    pub fn position(&self) -> usize;
    pub fn set_raw_text_mode(&mut self, mode: RawTextMode, end_tag: &str);
    pub fn next_token(&mut self) -> Token;
}

pub fn tokenize(input: &str) -> Vec<Token>;
```

`tokenize` 是一次性取全部记号的便利函数。需要按需取用（比如树构建那样一边取一边改模式）就用 `Tokenizer` 本身。

`position()` 返回当前扫到的字节偏移，用来把解析错误定位回源码。

## 顺序敏感的地方

**属性名统一转小写**，属性值不转。`<DIV CLASS="Note">` 的名字是 `div class`，值是 `Note`。

**重复属性只保留第一个。** 规范要求后来的同名属性被丢弃并报错；这里丢掉了，错误列表不维护。

**自闭合斜杠只对特定标签有意义。** `<br/>` 的斜杠是合法的，`<div/>` 的斜杠会被忽略——HTML 里 `div` 不是自闭合元素。这个判断在树构建那一层做，词法器只如实记录看到了斜杠。

**`<` 后面跟的不是字母就是文本。** `a < b` 里的 `<` 是文本，不是标签开头。

## 测试

39 条。覆盖的重点在容易出错的地方：各个原始文本模式的边界、脚本数据的双重转义、注释的各种畸形写法、DOCTYPE 的怪异模式判定、属性值的引号处理。

手工构造这类输入比读规范快——规范里的状态机描述有几十个状态，每一种组合都是一条潜在的用例。
