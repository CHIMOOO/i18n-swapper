const vscode = require('vscode');

/**
 * 高亮和装饰服务
 * 处理代码高亮和装饰相关功能
 */
class HighlightService {
  /**
   * 构造函数
   */
  constructor() {
    // 创建高亮装饰器类型
    this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 193, 7, 0.3)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#FFC107',
      borderRadius: '3px',
      overviewRulerColor: '#FFC107',
      overviewRulerLane: vscode.OverviewRulerLane.Center
    });

    // 高亮定时器
    this.highlightTimer = null;
  }

  /**
   * 高亮显示源文本
   * @param {vscode.TextDocument} document 文档对象
   * @param {number} start 开始位置
   * @param {number} end 结束位置
   * @param {Object} item 项目对象（可选）
   */
  async highlightSourceText(document, start, end, item = null) {
    try {
      if (!document) {
        vscode.window.showWarningMessage('没有打开的文档');
        return;
      }

      // 如果提供了项目，则使用项目中的开始和结束位置
      if (item && typeof item.start === 'number' && typeof item.end === 'number') {
        start = item.start;
        end = item.end;
      }

      // 获取当前所有可见编辑器
      const visibleEditors = vscode.window.visibleTextEditors;

      // 查找包含目标文档的编辑器
      let targetEditor = null;
      for (const editor of visibleEditors) {
        if (editor.document.uri.toString() === document.uri.toString()) {
          targetEditor = editor;
          break;
        }
      }

      // 如果没找到目标编辑器，尝试显示文档但不切换焦点
      if (!targetEditor) {
        // 使用preserveFocus:true保持面板焦点
        await vscode.window.showTextDocument(document, {
          preserveFocus: true,
          viewColumn: vscode.ViewColumn.One // 强制使用第一个视图列
        });

        // 重新获取编辑器引用
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === document.uri.toString()) {
            targetEditor = editor;
            break;
          }
        }
      }

      // 如果仍然没有找到目标编辑器，给出错误提示
      if (!targetEditor) {
        vscode.window.showErrorMessage('无法定位到源文档编辑器');
        return;
      }

      // 创建位置范围
      const startPos = document.positionAt(start);
      const endPos = document.positionAt(end);
      const range = new vscode.Range(startPos, endPos);

      // 滚动到位置并居中显示
      targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      // 添加高亮装饰
      targetEditor.setDecorations(this.highlightDecorationType, [range]);

      // 设置选择
      targetEditor.selection = new vscode.Selection(startPos, endPos);

      // 清除之前的定时器
      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
      }

      // 5秒后自动清除高亮
      this.highlightTimer = setTimeout(() => {
        targetEditor.setDecorations(this.highlightDecorationType, []);
        this.highlightTimer = null;
      }, 5000);

    } catch (error) {
      console.error('高亮源文本出错:', error);
      vscode.window.showErrorMessage(`高亮文本失败: ${error.message}`);
    }
  }

  /**
   * 更新装饰风格设置
   * @param {string} style 装饰风格
   */
  async updateDecorationStyle(style) {
    try {
      // 更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('decorationStyle', style, vscode.ConfigurationTarget.Workspace);

      // 通知用户
      const styleNames = {
        'suffix': "t('key')(译文)",
        'inline': "t(译文)"
      };
      vscode.window.showInformationMessage(`已将i18n装饰显示风格设置为: ${styleNames[style]}`);

      // 发送命令刷新装饰
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
    } catch (error) {
      console.error('更新装饰风格设置时出错:', error);
      vscode.window.showErrorMessage(`更新装饰风格出错: ${error.message}`);
    }
  }

  /**
   * 更新装饰样式设置
   * @param {Object} data 样式配置对象
   */
  async updateDecorationStyles(data) {
    try {
      const {
        decorationStyle,
        suffixStyle,
        inlineStyle
      } = data;

      // 使用VSCode API更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('decorationStyle', decorationStyle, vscode.ConfigurationTarget.Workspace);
      await config.update('suffixStyle', suffixStyle, vscode.ConfigurationTarget.Workspace);
      await config.update('inlineStyle', inlineStyle, vscode.ConfigurationTarget.Workspace);

      // 应用新的样式
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');

      // 提示用户
      vscode.window.showInformationMessage('已更新装饰样式设置，手动返回代码页面激活生效。');
    } catch (error) {
      console.error('更新装饰样式设置时出错:', error);
      vscode.window.showErrorMessage(`更新样式设置失败: ${error.message}`);
    }
  }

  /**
   * 更新缺失键样式
   * @param {Object} styles 样式设置
   */
  async updateMissingKeyStyles(styles) {
    try {
      const {
        missingKeyBorderWidth, 
        missingKeyBorderStyle, 
        missingKeyBorderColor, 
        missingKeyBorderSpacing
      } = styles;

      // 更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');

      // 逐项更新配置
      await config.update('missingKeyBorderWidth', missingKeyBorderWidth, vscode.ConfigurationTarget.Workspace);
      await config.update('missingKeyBorderStyle', missingKeyBorderStyle, vscode.ConfigurationTarget.Workspace);
      await config.update('missingKeyBorderColor', missingKeyBorderColor, vscode.ConfigurationTarget.Workspace);
      await config.update('missingKeyBorderSpacing', missingKeyBorderSpacing, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage('缺失键样式设置已保存，返回代码页面重新激活');

      // 刷新装饰器
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');
    } catch (error) {
      console.error('更新缺失键样式失败:', error);
      vscode.window.showErrorMessage(`更新缺失键样式失败: ${error.message}`);
    }
  }

  /**
   * 更新内联模式编辑时显示译文预览设置
   * @param {boolean} showPreview 是否显示预览
   */
  async updateShowPreviewInEdit(showPreview) {
    try {
      // 使用VSCode API更新配置
      const config = vscode.workspace.getConfiguration('i18n-swapper');
      await config.update('showFullFormInEditMode', showPreview, vscode.ConfigurationTarget.Workspace);

      // 刷新装饰
      await vscode.commands.executeCommand('i18n-swapper.refreshI18nDecorations');

      vscode.window.showInformationMessage(
        showPreview ?
        '已启用内联模式编辑时显示译文预览' :
        '已禁用内联模式编辑时显示译文预览'
      );
    } catch (error) {
      console.error('更新译文预览设置时出错:', error);
      vscode.window.showErrorMessage(`更新译文预览设置失败: ${error.message}`);
    }
  }

  /**
   * 刷新代码高亮
   * @param {vscode.TextDocument} document 文档对象
   * @param {Array} items 需要高亮的项目列表
   */
  async refreshHighlights(document, items) {
    // 如果没有文档或项目，则不需要高亮
    if (!document || !items || items.length === 0) {
      return;
    }

    try {
      // 获取可见编辑器
      const visibleEditors = vscode.window.visibleTextEditors;
      const targetEditor = visibleEditors.find(
        editor => editor.document.uri.toString() === document.uri.toString()
      );

      // 如果找不到对应的编辑器，则退出
      if (!targetEditor) {
        return;
      }

      // 清除之前的高亮
      targetEditor.setDecorations(this.highlightDecorationType, []);

      // 如果处于全局扫描模式，可能不需要高亮显示所有项目
      // 这里只处理当前可见文档的项目
      const documentItems = items.filter(item => 
        !item.fileUri || item.fileUri.toString() === document.uri.toString()
      );

      // 如果没有项目需要高亮，则退出
      if (documentItems.length === 0) {
        return;
      }

      // 创建高亮范围
      const ranges = documentItems
        .filter(item => !item.replaced && typeof item.start === 'number' && typeof item.end === 'number')
        .map(item => {
          const startPos = document.positionAt(item.start);
          const endPos = document.positionAt(item.end);
          return new vscode.Range(startPos, endPos);
        });

      // 设置高亮装饰
      if (ranges.length > 0) {
        targetEditor.setDecorations(this.highlightDecorationType, ranges);
      }
    } catch (error) {
      console.error('刷新高亮时出错:', error);
      // 这里不抛出异常，以避免影响面板更新
    }
  }

  /**
   * 销毁服务
   */
  dispose() {
    // 清除高亮定时器
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }

    // 清除高亮装饰
    if (this.highlightDecorationType) {
      this.highlightDecorationType.dispose();
    }
  }
}

module.exports = HighlightService; 