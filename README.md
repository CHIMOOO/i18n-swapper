# i18n Swapper

一站式国际化（i18n）解决方案：实时翻译预览、智能替换、批量处理、多语言管理。

## 技术栈

| 层级 | 技术 |
|------|------|
| 扩展后端 | TypeScript + esbuild |
| WebView 前端 | Vue 3 + Vite + Tailwind CSS v4 + Pinia |
| 包管理器 | pnpm (workspace) |

## 项目结构

```
new-i18n-swapper/
├── src/
│   ├── extension/          # VSCode 扩展后端
│   │   └── extension.ts    # 入口文件
│   └── webview/            # WebView 前端 (Vue 3)
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.ts
│       │   ├── components/
│       │   ├── stores/
│       │   └── styles/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
├── docs/                   # 产品 & 技术文档
├── dist/                   # 构建产物（git 忽略）
├── package.json            # 扩展清单 + 根依赖
├── tsconfig.json           # TS 项目引用
├── esbuild.config.mjs      # 扩展后端构建
└── pnpm-workspace.yaml     # pnpm 工作区配置
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（同时启动扩展后端和 WebView 前端的 watch 构建）
pnpm run dev

# 构建
pnpm run build

# 类型检查
pnpm run type-check          # 扩展后端
pnpm run type-check:webview  # WebView 前端

# 打包 .vsix
pnpm run package
```

## 调试

1. 按 `F5` 启动扩展开发宿主
2. 在命令面板中搜索 `i18n Swapper` 执行命令

## 文档

- [产品分析文档](docs/product-analysis.md)
- [技术实现文档](docs/technical-implementation-guide.md)
- [跨平台国际化分析](docs/cross-platform-i18n-analysis.md)
