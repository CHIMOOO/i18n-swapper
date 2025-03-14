# i18n-swapper

<p align="center">
  <img src="images/name.jpg" alt="chimoo's logo" width="128">
</p>

> 一个高效的 VSCode 国际化文本替换工具 / An efficient i18n text replacement tool for VSCode

## 中文说明

i18n-swapper 是一个 VSCode 扩展，用于帮助开发者快速查找和替换国际化文本。它可以自动在国际化资源文件中查找选中文本对应的键，并替换为国际化函数调用。

### 特性

- 🔍 **智能文本查找**：自动在国际化文件中查找选中文本对应的键
- 📂 **多文件支持**：可配置多个国际化文件路径，同时支持 JSON 和 JS 格式
- 🔤 **智能引号处理**：自动识别和处理选中文本中的引号，无需担心选择精度问题
- ⚙️ **灵活配置**：支持自定义国际化函数名称和引号样式


### 安装

可以通过以下几种方式安装：

1. 在 VSCode 中，按 `Ctrl+P` 打开命令面板，输入：
   ```
   ext install chimoo.i18n-swapper
   ```

2. 或者从 [VSCode 插件市场](https://marketplace.visualstudio.com/items?itemName=chimoo.i18n-swapper) 直接下载安装

3. 从 [GitHub 仓库](https://github.com/CHIMOOO/i18n-swapper) 下载源码自行构建

### 使用方法

1. 在代码中选中需要国际化的文本（可以带引号也可以不带）
2. 按快捷键 `Ctrl+Alt+I`（Windows/Linux）或 `Cmd+Alt+I`（Mac）
3. 或右键菜单选择 "替换为国际化调用"
4. 插件会自动查找对应的国际化键并替换为函数调用

#### 支持的选择方式

- 直接选择文本："你好世界"
- 选择带引号的文本：`"你好世界"` 或 `'你好世界'`
- 只选择引号内的文本，插件会智能识别并扩展选择范围

### 配置选项

在 `.vscode/settings.json` 中添加以下配置：

```json
{
  "i18n-swapper.localesPaths": [
    "src/locales/zh-CN.json",
    "src/i18n/messages.js",
    "src/translations/cn.json"
  ],
  "i18n-swapper.quoteType": "single", 
  "i18n-swapper.functionName": "t"
}
```

| 配置项 | 说明 | 默认值 |
| ----- | ---- | ----- |
| `localesPaths` | 国际化文件路径列表 | `["src/locales/zh-CN.json"]` |
| `quoteType` | 生成的代码中使用的引号类型（`single` 或 `double`） | `single` |
| `functionName` | 国际化函数名称 | `t` |

### 使用场景

#### 场景一：Vue 组件中使用

原始代码：
```vue
<template>
  <div class="welcome">
    <h1>欢迎使用我们的应用</h1>
    <p>这是一个很棒的应用程序</p>
  </div>
</template>
```

替换后：
```vue
<template>
  <div class="welcome">
    <h1>{{ t('welcome.title') }}</h1>
    <p>{{ t('welcome.description') }}</p>
  </div>
</template>
```

#### 场景二：JavaScript/TypeScript 中使用

原始代码：
```javascript
function showMessage() {
  alert("欢迎使用我们的应用");
  console.log("用户已登录系统");
}
```

替换后：
```javascript
function showMessage() {
  alert(t('welcome.message'));
  console.log(t('user.loggedIn'));
}
```

### 常见问题

**Q: 为什么插件找不到我的国际化键？**

A: 请确保配置的国际化文件路径正确，并且该文件中确实存在与选中文本完全匹配的值。

**Q: 插件支持哪些文件格式？**

A: 目前支持 JSON 和 JS 文件。JS 文件需要导出一个对象。

**Q: 如何修改快捷键？**

A: 通过 VSCode 的快捷键设置（`File > Preferences > Keyboard Shortcuts`）可以修改。

**Q: 我的项目使用的不是 `t()` 函数怎么办？**

A: 可以通过 `i18n-swapper.functionName` 配置自定义函数名称，比如 `$t`、`i18n.t` 等。

## English Description

i18n-swapper is a VSCode extension that helps developers quickly find and replace internationalized text. It automatically searches for keys corresponding to selected text in internationalization resource files and replaces them with internationalization function calls.

### Features

- 🔍 **Smart text search**: Automatically finds keys in internationalization files that match selected text
- 📂 **Multi-file support**: Configure multiple internationalization file paths, supporting both JSON and JS formats
- 🔤 **Smart quote handling**: Automatically recognizes and processes quotes in selected text
- ⚙️ **Flexible configuration**: Supports customizing the internationalization function name and quote style

### Installation

You can install it in several ways:

1. In VSCode, press `Ctrl+P` to open the command palette, then type:
   ```
   ext install chimoo.i18n-swapper
   ```

2. Or download directly from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=chimoo.i18n-swapper)

3. Build from source code downloaded from the [GitHub repository](https://github.com/CHIMOOO/i18n-swapper)

### How to Use

1. Select the text that needs to be internationalized in your code (with or without quotes)
2. Press the shortcut key `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (Mac)
3. Or right-click and select "Replace with i18n Call" from the context menu
4. The plugin will automatically find the corresponding internationalization key and replace it with a function call

#### Supported selection methods

- Direct text selection: "Hello World"
- Selection with quotes: `"Hello World"` or `'Hello World'`
- Selection of text inside quotes - the plugin will intelligently recognize and expand the selection range

### Configuration Options

Add the following configuration to `.vscode/settings.json`:

```json
{
  "i18n-swapper.localesPaths": [
    "src/locales/en-US.json",
    "src/i18n/messages.js",
    "src/translations/en.json"
  ],
  "i18n-swapper.quoteType": "single", 
  "i18n-swapper.functionName": "t"
}
```

| Option | Description | Default Value |
| ----- | ---- | ----- |
| `localesPaths` | List of internationalization file paths | `["src/locales/zh-CN.json"]` |
| `quoteType` | Quote type used in generated code (`single` or `double`) | `single` |
| `functionName` | Internationalization function name | `t` |

### Use Cases

#### Case 1: In Vue Components

Original code:
```vue
<template>
  <div class="welcome">
    <h1>Welcome to our application</h1>
    <p>This is an awesome application</p>
  </div>
</template>
```

After replacement:
```vue
<template>
  <div class="welcome">
    <h1>{{ t('welcome.title') }}</h1>
    <p>{{ t('welcome.description') }}</p>
  </div>
</template>
```

#### Case 2: In JavaScript/TypeScript

Original code:
```javascript
function showMessage() {
  alert("Welcome to our application");
  console.log("User has logged into the system");
}
```

After replacement:
```javascript
function showMessage() {
  alert(t('welcome.message'));
  console.log(t('user.loggedIn'));
}
```

### FAQ

**Q: Why can't the plugin find my internationalization key?**

A: Please ensure the configured internationalization file path is correct and that the file actually contains a value that exactly matches the selected text.

**Q: Which file formats does the plugin support?**

A: Currently, it supports JSON and JS files. JS files need to export an object.

**Q: How do I change the shortcut key?**

A: You can modify it through VSCode's keyboard shortcut settings (`File > Preferences > Keyboard Shortcuts`).

**Q: My project doesn't use the `t()` function. What should I do?**

A: You can customize the function name through the `i18n-swapper.functionName` configuration, such as `$t`, `i18n.t`, etc.

## 许可证 / License

MIT

---

Made with ❤️ by chimoo
