# i18n-swapper 国际化文本替换工具

<p align="center">
  <img src="images/name.jpg" alt="chimoo's logo" width="128">
</p>

> 一个高效的 VSCode 国际化文本替换工具

## 功能介绍

i18n-swapper 是一个 VSCode 扩展，用于帮助开发者快速查找和替换国际化文本。它可以自动在国际化资源文件中查找选中文本对应的键，并替换为国际化函数调用。

### 功能特点

- 🔍 **智能检测**：自动识别代码中需要国际化的文本
- 🔄 **一键替换**：将选中文本快速替换为国际化函数调用
- 📦 **批量处理**：批量检测和替换需要国际化的文本
- 🌐 **多语言支持**：支持多种语言的自动翻译
- 👁️ **实时预览**：在代码中直接查看翻译结果
- ⚙️ **灵活配置**：支持自定义国际化函数名、样式等

### 核心功能亮点 ✨

专为中文项目设计的国际化解决方案，提供全流程开发支持：

1. **智能键值生成 & 多语言同步**
   ⌨️ 中文内容智能生成标准化键值，实时对接腾讯云翻译引擎，支持一键生成 28+ 语种翻译文件。告别重复劳动，实现多语言资源自动化同步。

2. **智能路径反推**
   🔍 基于输入内容自动定位现有国际化文件中的键路径，开发人员无需手动检索翻译文件，大幅提升维护效率。

3. **多维度翻译洞察**
   🌐 可视化呈现键值的全语种翻译状态，支持：
   - 跨语言翻译对比检查
   - 缺失翻译智能提醒
   - 一键定位目标文件路径
   - 快速跳转代码引用位置

4. **云翻译服务深度集成**
   ☁️ 无缝对接腾讯云机器翻译 API，通过配置文件快速接入：
   开发者仅需专注业务键值设计，翻译工作流完全自动化。

### 主要特性

- 🔍 **智能文本查找**：自动在国际化文件中查找选中文本对应的键
- 📂 **多文件支持**：可配置多个国际化文件路径，同时支持 JSON 和 JS 格式
- 🔤 **智能引号处理**：自动识别和处理选中文本中的引号，无需担心选择精度问题
- ⚙️ **灵活配置**：支持自定义国际化函数名称和引号样式
- 🚀 **批量替换能力**：支持一键扫描当前文件中所有需要国际化的文本并批量替换
- 🌍 **自动翻译**：集成腾讯云翻译 API，支持一键翻译和多语言文件生成
- 👁️ **预览功能**：实时预览国际化键对应的翻译内容，提升开发体验
- 📊 **翻译状态管理**：可视化展示不同语言文件中的翻译状态，快速识别缺失翻译

### 翻译方式

#### 1. 单体翻译功能

选中需要翻译的文本，右键菜单选择"替换为国际化调用"或使用快捷键 `Ctrl+Alt+I`（Windows/Linux）/ `Cmd+Alt+I`（Mac），插件会:
- 自动在国际化文件中查找选中文本对应的键
- 如果找不到，会提示输入新的键名
- 智能处理文本周围的引号和括号
- 替换为国际化函数调用，如 `t('key')`

#### 2. 批量翻译功能

提供两种批量翻译方式:

- **快速批量替换**: 一键扫描当前文件中所有需要国际化的文本，对已在国际化文件中存在的文本自动替换
- **批量替换面板**: 打开可视化界面，展示所有可替换文本，支持手动设置国际化键，选择性批量替换

#### 3. 自定义字段扫描

可以配置要扫描的属性字段模式（如 label、placeholder、title 等），插件会优先识别这些字段中的文本进行替换，提高批量替换的准确性。

#### 4. 多语言翻译管理

- **一键生成语言文件**: 基于源语言文件，快速创建多种语言的国际化文件
- **翻译服务集成**: 使用腾讯云翻译 API 自动翻译已有的国际化内容
- **翻译状态可视化**: 直观展示各语言翻译状态，方便管理多语言资源

## 安装

可以通过以下几种方式安装：

1. 在 VSCode 中，按 `Ctrl+P` 打开命令面板，输入：
   ```
   ext install chimoo.i18n-swapper
   ```

2. 或直接从 [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=chimoo.i18n-swapper) 下载

## 快速上手

### 1. 配置国际化文件路径

首次使用时，请先设置国际化文件路径：

1. 使用快捷键 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（Mac）打开命令面板
2. 输入并选择 `i18n-swapper: 设置国际化文件路径`
3. 选择您的国际化文件（JSON或JS格式）

### 2. 单个文本替换

1. 在代码中选择需要国际化的文本
2. 使用快捷键 `Alt+Shift+I`（Windows/Linux）或 `Option+Shift+I`（Mac）
3. 文本将被替换为国际化函数调用，如 `t('your.i18n.key')`

### 3. 批量替换

1. 打开需要国际化的文件
2. 使用快捷键 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（Mac）打开命令面板
3. 输入并选择 `i18n-swapper: 批量替换国际化`
4. 在弹出的面板中选择需要替换的文本，并执行替换

### 4. 快速批量替换

1. 打开需要国际化的文件
2. 使用快捷键 `Alt+Shift+B`（Windows/Linux）或 `Option+Shift+B`（Mac）
3. 在编辑器中直接选择并确认要替换的文本

## 配置选项

在 `.vscode/settings.json` 中添加以下配置：

```json
{
    "i18n-swapper.localesPaths": [
        "src/locales/zh-CN.json",
        "src/i18n/messages.js"
    ],
    "i18n-swapper.quoteType": "single",
    "i18n-swapper.functionName": "t",
    "i18n-swapper.scanPatterns": [
        "value",
        "label",
        "placeholder",
        "message",
        "title",
        "text"
    ],
    "i18n-swapper.tencentTranslation.apiKey": "",
    "i18n-swapper.tencentTranslation.apiSecret": "",
    "i18n-swapper.tencentTranslation.region": "ap-guangzhou",
    "i18n-swapper.tencentTranslation.sourceLanguage": "zh",
    "i18n-swapper.decorationStyle": "suffix"
}

```
| 选项 | 说明 | 默认值 |
| ----- | ---- | ----- |
| `localesPaths` | 国际化文件路径列表 | `[]` |
| `quoteType` | 生成代码中使用的引号类型 (`single` 或 `double`) | `single` |
| `functionName` | 国际化函数名称 | `t` |
| `scanPatterns` | 要扫描的属性模式列表（用于批量替换） | `[]` |
| `tencentTranslation.apiKey` | 腾讯云翻译 API 密钥 | `""` |
| `tencentTranslation.apiSecret` | 腾讯云翻译 API 密钥 | `""` |
| `tencentTranslation.region` | 腾讯云 API 区域 | `"ap-guangzhou"` |
| `tencentTranslation.sourceLanguage` | 源语言代码 | `"zh"` |
| `decorationStyle` | 国际化键预览样式 (`suffix` 或 `inline`) | `"suffix"` |


## 项目结构

# I18n Swapper - 项目结构

## 核心文件

- `extension.js` - 插件入口点，注册命令和激活上下文
- `src/panels/BatchReplacementPanel.js` - 批量替换面板的主类，协调各种服务

## 服务模块

- `src/panels/services/highlightService.js` - 处理代码高亮和装饰相关功能
- `src/panels/services/i18nKeyStatusService.js` - 管理i18n键在不同语言文件中的状态
- `src/panels/services/translationPanelService.js` - 处理面板中的翻译相关操作
- `src/panels/services/documentAnalyzer.js` - 分析文档内容，识别可国际化的文本
- `src/panels/services/languageFileManager.js` - 管理语言文件的创建和选择
- `src/panels/services/replacementService.js` - 处理文本替换为国际化调用的逻辑
- `src/panels/services/translationService.js` - 处理翻译API相关功能

## 界面相关

- `src/panels/ui/panelHtmlGenerator.js` - 生成面板的HTML内容

## 工具和配置

- `src/utils/language-mappings.js` - 语言映射相关常量
- `src/utils/index.js` - 通用工具函数
- `src/config/defaultsConfig.js` - 默认配置项

## 模块化设计

该项目采用模块化设计，将功能分散到多个专门的服务中：

1. **主控制器** - `BatchReplacementPanel.js` 作为主控制器，协调各个服务模块
2. **服务模块** - 每个服务模块负责一个特定功能领域：
   - 高亮服务 - 处理代码高亮和装饰
   - i18n键状态服务 - 管理国际化键的状态
   - 翻译面板服务 - 处理翻译相关操作
   - 文档分析服务 - 分析文档内容
   - 语言文件管理服务 - 处理语言文件
   - 替换服务 - 执行文本替换操作
3. **用户界面** - 界面生成与业务逻辑分离

模块间通过回调函数或状态对象传递，确保功能完整性的同时实现代码模块化。

这种设计具有以下优点：
- 提高代码可维护性和可读性
- 关注点分离，使每个模块职责清晰
- 便于测试和调试
- 支持团队协作开发

## 常见问题

**Q: 为什么插件找不到我的国际化键？**

A: 请确保配置的国际化文件路径正确，并且该文件中确实存在与选中文本完全匹配的值。

**Q: 插件支持哪些文件格式？**

A: 目前支持 JSON 和 JS 文件。JS 文件需要导出一个对象。

**Q: 如何修改快捷键？**

A: 通过 VSCode 的快捷键设置（`File > Preferences > Keyboard Shortcuts`）可以修改。

**Q: 我的项目使用的不是 `t()` 函数怎么办？**

A: 可以通过 `i18n-swapper.functionName` 配置自定义函数名称，比如 `$t`、`i18n.t` 等。

**Q: 如何获取腾讯云 API 密钥？**

A: 访问[腾讯云控制台](https://console.cloud.tencent.com/)，在【访问管理】->【API密钥管理】中创建密钥，并在【机器翻译】控制台开通机器翻译服务。

**Q: 支持哪些语言的翻译？**

A: 支持腾讯云翻译 API 提供的全部语言，包括英语、日语、韩语、法语、西班牙语等28+种语言。


## 许可证

i18n-swapper 遵循 [Apache License 2.0](LICENSE) 许可证。

