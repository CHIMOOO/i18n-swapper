# i18n-swapper 国际化文本替换工具

<p align="center">
  <img src="images/name.jpg" alt="chimoo's logo" width="128">
</p>

> 一个高效的 VSCode 国际化文本替换工具

## 功能介绍

i18n-swapper 是一个 VSCode 扩展，用于帮助开发者快速查找和替换国际化文本。它可以自动在国际化资源文件中查找选中文本对应的键，并替换为国际化函数调用。

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

## 使用方法

### 基础配置

首先，设置国际化文件路径。您可以通过以下方式之一：

1. 命令面板执行 `i18n-swapper: 设置国际化文件路径`
2. 右键菜单选择 `设置国际化文件路径`
3. 在设置中手动配置 `i18n-swapper.localesPaths`

### 单体替换

1. 选中需要国际化的文本（可带可不带引号）
2. 按快捷键 `Ctrl+Alt+I`（Windows/Linux）或 `Cmd+Alt+I`（Mac）
3. 或右键选择"替换为国际化调用"

### 批量替换

1. 打开需要处理的文件
2. 右键菜单选择 `批量替换国际化` 或 `快速批量替换`
3. 在批量替换面板中，可以查看所有找到的文本，设置国际化键，选择性替换

### 多语言翻译

1. 右键菜单选择 `打开翻译管理面板`
2. 配置腾讯云 API 密钥和区域
3. 设置源语言和目标语言映射
4. 点击 `执行翻译` 将源语言内容翻译到所有目标语言文件中

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

```
i18n-swapper/
├── extension.js # 插件入口文件，注册命令和激活插件
├── src/ # 源代码目录
│ ├── commands/ # 命令模块目录
│ │ ├── index.js # 命令导出文件
│ │ ├── replaceWithI18n.js # 单体替换命令实现
│ │ ├── batchReplaceWithI18n.js # 批量替换命令实现
│ │ ├── quickBatchReplace.js # 快速批量替换命令实现
│ │ └── setLocalesPaths.js # 设置国际化文件路径命令实现
│ ├── panels/ # UI面板目录
│ │ ├── BatchReplacementPanel.js # 批量替换面板实现
│ │ ├── ApiTranslationPanel.js # 翻译管理面板实现
│ │ └── services/ # 面板服务模块
│ │ ├── documentAnalyzer.js # 文档分析服务
│ │ └── languageFileManager.js # 语言文件管理服务
│ ├── features/ # 功能模块目录
│ │ ├── i18nPreview.js # 国际化预览功能
│ │ └── textDecoration/ # 文本装饰功能
│ │ ├── i18nPreviewProvider.js # 国际化预览提供器
│ │ └── i18nKeyExtractor.js # 国际化键提取工具
│ └── utils/ # 工具函数目录
│ ├── index.js # 工具函数导出文件
│ ├── i18n-helper.js # 国际化辅助工具
│ ├── text-analyzer.js # 文本分析工具
│ ├── text-replacer.js # 文本替换工具
│ └── language-mappings.js # 语言代码映射工具
├── package.json # 插件配置文件
└── README.md # 说明文档
```

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

