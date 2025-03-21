# 国际化面板UI模块

本目录包含国际化面板的UI相关代码，采用模块化结构组织。

## 文件结构

```
src/panels/ui/
├── components/         # UI组件
│   └── panelTemplate.js  # 面板HTML模板生成
├── styles/             # 样式相关
│   └── panelStyles.js    # 面板样式生成
├── scripts/            # JavaScript相关
│   └── panelScripts.js   # 面板脚本生成
├── utils/              # 工具函数
│   └── htmlUtils.js      # HTML相关工具函数
└── panelHtmlGenerator.js # 主入口文件，组合以上模块
```

## 模块说明

### 1. panelHtmlGenerator.js

主入口文件，负责协调其他模块并生成完整的HTML页面。

### 2. components/panelTemplate.js

包含面板HTML结构模板生成的函数，主要负责生成各种HTML组件，如表格、列表等。

### 3. styles/panelStyles.js

生成面板所需的CSS样式，包括主题颜色、布局等所有样式定义。

### 4. scripts/panelScripts.js

生成面板所需的JavaScript代码，负责事件处理、状态管理等交互功能。

### 5. utils/htmlUtils.js

提供HTML相关的工具函数，如HTML转义等通用功能。

## 设计原则

1. **模块化**: 每个模块专注于单一职责
2. **可维护性**: 通过分离关注点使代码更易于维护
3. **可扩展性**: 新功能可以轻松添加到相应模块中
4. **性能优化**: 通过结构化组织减少冗余，提高性能

## 开发指南

### 添加新功能

1. 确定功能所属模块
2. 在对应模块中实现功能
3. 如需要，在主入口文件中进行组合

### 修改现有功能

1. 找到功能所在模块
2. 修改对应代码
3. 测试确保变更不影响其他功能 