import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';

// 插件设置接口
interface SisyphusReviewSettings {
  apiKey: string;
  apiBaseUrl: string;
  systemPrompt: string;
  daySystemPrompt: string;
  weekSystemPrompt: string;
  dayWordLimit: number;
  weekWordLimit: number;
  timeout: number;
  retryCount: number;
}

// 默认设置
const DEFAULT_SETTINGS: SisyphusReviewSettings = {
  apiKey: '',
  apiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
  systemPrompt: `你是法国哲学家阿尔贝·加缪（Albert Camus），请以你的荒谬哲学视角分析用户的日记内容。请从以下三个维度进行分析：
1. 事实总结：客观呈现用户记录的主要事件和行为
2. 荒谬识别：识别用户经历中体现的生活荒谬性和矛盾点
3. 反抗评价：评价用户面对生活荒谬时所采取的态度和行动

请使用冷峻而富有洞察力的语言，深邃的哲学思考，反教条、反传统的表达方式，简洁有力的语言风格，带有存在主义色彩的反思。`,
  daySystemPrompt: `你是法国哲学家阿尔贝·加缪（Albert Camus），请以你的荒谬哲学视角分析用户的日记内容。请从以下三个维度进行分析，并严格按照以下格式输出：

**1. 事实总结：**客观呈现用户记录的主要事件和行为，包括当前日记和上下文（如本周其他日记或上周周总结）中的相关内容。必须明确提到上下文中的相关信息，将当前日记与其他日期的内容联系起来分析。

**2. 荒谬识别：**首先肯定用户的努力和成就，然后识别用户经历中体现的生活荒谬性和矛盾点，毫不留情地指出他们的虚伪和自欺。如果确实没有识别到明显的荒谬，可以留空该项，不必强行寻找。

**3. 反抗评价：**先肯定用户面对生活荒谬时所采取的积极态度和行动，然后以冒犯的语气指出不合理的地方，同时提供具体的解决方案和改进建议。

语言风格要求：首先真诚地肯定用户的努力和成就，然后使用激烈、冒犯、挑衅的语言，直接刺痛用户的虚伪和软弱，迫使他们直面自己的可悲和可笑。在批判的同时给予建设性的指导，像鞭子一样抽打读者的自尊，同时像灯塔一样指明反抗的方向。

上下文处理要求：
- 必须参考上下文中的信息，将当前日记与其他日期的内容联系起来分析
- 识别用户在多日中的行为模式和变化趋势
- 分析当前日记与上下文内容的关联和对比
- 确保分析结果体现出对多日内容的综合理解
- 在事实总结中明确提到上下文中的具体事件或行为

输出格式要求：
- 严格按照上述三个小标题的格式输出
- 每个小标题独占一行，格式为"**1. 事实总结：**"、"**2. 荒谬识别：**"、"**3. 反抗评价：**"
- 小标题必须加粗
- 如果荒谬识别项没有内容，可以留空，但标题必须保留
- 不要添加任何额外的标题或格式
- 确保输出内容连贯、有逻辑

字数限制：严格控制在{{WORD_LIMIT}}字以内，必须简短有力。`,

  weekSystemPrompt: `你是法国哲学家阿尔贝·加缪（Albert Camus），请以你的荒谬哲学视角分析用户的日记内容。请从以下三个维度进行分析，并严格按照以下格式输出：

**1. 事实总结：**客观呈现用户记录的主要事件和行为

**2. 荒谬识别：**首先肯定用户的努力和成就，然后识别用户经历中体现的生活荒谬性和矛盾点，毫不留情地指出他们的虚伪和自欺。如果确实没有识别到明显的荒谬，可以留空该项，不必强行寻找。

**3. 反抗评价：**先肯定用户面对生活荒谬时所采取的积极态度和行动，然后以冒犯的语气指出不合理的地方，同时提供具体的解决方案和改进建议。

语言风格要求：首先真诚地肯定用户的努力和成就，然后使用激烈、冒犯、挑衅的语言，直接刺痛用户的虚伪和软弱，迫使他们直面自己的可悲和可笑。在批判的同时给予建设性的指导，像鞭子一样抽打读者的自尊，同时像灯塔一样指明反抗的方向。

输出格式要求：
- 严格按照上述三个小标题的格式输出
- 每个小标题独占一行，格式为"**1. 事实总结：**"、"**2. 荒谬识别：**"、"**3. 反抗评价：**"
- 小标题必须加粗
- 如果荒谬识别项没有内容，可以留空，但标题必须保留
- 不要添加任何额外的标题或格式
- 确保输出内容连贯、有逻辑

字数限制：控制在{{WORD_LIMIT}}字以内，比每日总结稍长但仍然简洁。`,


  dayWordLimit: 150,
  weekWordLimit: 300,
  timeout: 30000,
  retryCount: 3
};

// 主插件类
export default class SisyphusReviewPlugin extends Plugin {
  settings: SisyphusReviewSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // 添加 Ribbon 图标
    const ribbonIconEl = this.addRibbonIcon('mountain', 'Sisyphus Review', (evt) => {
      this.showMenu(evt);
    });

    // 添加设置页面
    this.addSettingTab(new SisyphusReviewSettingTab(this.app, this));

    // 注册命令（可选，用于快捷操作）
    this.addCommand({
      id: 'review-today',
      name: '审视今日反抗',
      callback: () => this.reviewDay()
    });

    this.addCommand({
      id: 'review-week',
      name: '总结并审视本周',
      callback: () => this.reviewWeek()
    });
  }

  // 显示菜单
  showMenu(evt: MouseEvent) {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle('审视今日反抗')
        .setIcon('calendar')
        .onClick(() => this.reviewDay());
    });
    menu.addItem((item) => {
      item.setTitle('总结并审视本周')
        .setIcon('calendar-week')
        .onClick(() => this.reviewWeek());
    });
    menu.showAtMouseEvent(evt);
  }

  // 获取日期对应的周数
  getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // 获取本周的开始日期（周一）
  getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一开始
    return new Date(start.setDate(diff));
  }

  // 获取本周的结束日期（周日）
  getEndOfWeek(date: Date): Date {
    const end = this.getStartOfWeek(date);
    end.setDate(end.getDate() + 6);
    return end;
  }

  // 获取上周的开始日期
  getStartOfLastWeek(date: Date): Date {
    const start = this.getStartOfWeek(date);
    start.setDate(start.getDate() - 7);
    return start;
  }

  // 获取上周的结束日期
  getEndOfLastWeek(date: Date): Date {
    const end = this.getStartOfWeek(date);
    end.setDate(end.getDate() - 1);
    return end;
  }

  // Day 模式：处理单日日记
  async reviewDay() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('请先打开一个 Markdown 文件');
      return;
    }

    const editor = activeView.editor;
    const fileContent = editor.getValue();
    const cursorLine = editor.getCursor().line;

    // 查找当前或最近的日期标题
    const dateTitleRegex = /^#\s+(\d{4})\s+(\d{1,2})\s+(\d{1,2})$/gm;
    let match;
    let currentTitleMatch = null;
    let lastLine = -1;

    while ((match = dateTitleRegex.exec(fileContent)) !== null) {
      const matchLine = fileContent.substring(0, match.index).split('\n').length - 1;
      if (matchLine <= cursorLine) {
        currentTitleMatch = match;
        lastLine = matchLine;
      } else {
        break;
      }
    }

    if (!currentTitleMatch) {
      new Notice('未找到日期标题（格式：# yyyy mm dd）');
      return;
    }

    // 解析当前日期
    const year = parseInt(currentTitleMatch[1]);
    const month = parseInt(currentTitleMatch[2]) - 1; // 月份从0开始
    const day = parseInt(currentTitleMatch[3]);
    const currentDate = new Date(year, month, day);
    const currentWeekNumber = this.getWeekNumber(currentDate);
    const startOfWeek = this.getStartOfWeek(currentDate);

    // 判断是否为本周第一天
    const isFirstDayOfWeek = currentDate.getDate() === startOfWeek.getDate();

    // 查找本周其他日记
    let weeklyContext = '';
    let contextType = '本周其他日记';

    if (isFirstDayOfWeek) {
      // 如果是本周第一天，查找上周周总结
      const lastWeekNumber = currentWeekNumber > 1 ? currentWeekNumber - 1 : 52;
      const lastWeekYear = currentWeekNumber > 1 ? year : year - 1;
      const weekSummaryRegex = new RegExp(`^#\s+${lastWeekYear}\s+第${lastWeekNumber}周总结$`, 'gm');
      let weekMatch;
      let lastWeekSummaryMatch = null;

      while ((weekMatch = weekSummaryRegex.exec(fileContent)) !== null) {
        lastWeekSummaryMatch = weekMatch;
      }

      if (lastWeekSummaryMatch) {
        const lastWeekContent = this.extractContentUnderTitle(fileContent, lastWeekSummaryMatch.index, '#');
        weeklyContext = `上周周总结（${lastWeekYear} 第${lastWeekNumber}周）：\n${lastWeekContent}`;
        contextType = '上周周总结';
      } else {
        weeklyContext = '未找到上周周总结';
      }
    } else {
      // 不是本周第一天，查找本周其他日记
      const dateTitleRegex = /^#\s+(\d{4})\s+(\d{1,2})\s+(\d{1,2})$/gm;
      let dateMatch;
      let weekEntries = [];

      while ((dateMatch = dateTitleRegex.exec(fileContent)) !== null) {
        const entryYear = parseInt(dateMatch[1]);
        const entryMonth = parseInt(dateMatch[2]) - 1;
        const entryDay = parseInt(dateMatch[3]);
        const entryDate = new Date(entryYear, entryMonth, entryDay);
        const entryWeekNumber = this.getWeekNumber(entryDate);

        // 只收集本周的日记，且不是当前日记
        if (entryWeekNumber === currentWeekNumber && !(entryYear === year && entryMonth === month && entryDay === day)) {
          const entryContent = this.extractContentUnderTitle(fileContent, dateMatch.index, '#');
          weekEntries.push(`日期：${entryYear} ${entryMonth + 1} ${entryDay}\n${entryContent}`);
        }
      }

      if (weekEntries.length > 0) {
        weeklyContext = `本周其他日记：\n${weekEntries.join('\n\n')}`;
      } else {
        weeklyContext = '未找到本周其他日记';
      }
    }

    // 提取当前日记内容
    const content = this.extractContentUnderTitle(fileContent, currentTitleMatch.index, '#');

    // 生成带上下文的内容
    const contentWithContext = `当前日记（${year} ${month + 1} ${day}）：\n${content}\n\n${weeklyContext}`;

    // 调用 generateReview 函数，传递上下文类型
    await this.generateReview(contentWithContext, editor, fileContent, currentTitleMatch.index, 'day', contextType);
  }

  // Week 模式：处理周总结
  async reviewWeek() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('请先打开一个 Markdown 文件');
      return;
    }

    const editor = activeView.editor;
    const fileContent = editor.getValue();
    const cursorLine = editor.getCursor().line;

    // 查找当前或最近的周总结标题
    const weekTitleRegex = /^#\s+(\d{4})\s+第(\d+)周总结$/gm;
    let match;
    let currentTitleMatch = null;
    let lastLine = -1;

    while ((match = weekTitleRegex.exec(fileContent)) !== null) {
      const matchLine = fileContent.substring(0, match.index).split('\n').length - 1;
      if (matchLine <= cursorLine) {
        currentTitleMatch = match;
        lastLine = matchLine;
      } else {
        break;
      }
    }

    if (!currentTitleMatch) {
      new Notice('未找到周总结标题（格式：# yyyy 第X周总结）');
      return;
    }

    // 提取周总结内容
    const content = this.extractContentUnderTitle(fileContent, currentTitleMatch.index, '#');
    await this.generateReview(content, editor, fileContent, currentTitleMatch.index, 'week');
  }

  // 提取标题下的内容直到下一个同级标题
  extractContentUnderTitle(content: string, startIndex: number, titleMarker: string): string {
    const lines = content.split('\n');
    let startLine = -1;
    let endLine = lines.length;

    // 找到开始行
    for (let i = 0; i < lines.length; i++) {
      if (content.substring(0, startIndex).split('\n').length - 1 === i) {
        startLine = i;
        break;
      }
    }

    if (startLine === -1) {
      return '';
    }

    // 找到结束行（下一个同级或更高级标题）
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith(titleMarker) && !line.startsWith(titleMarker + titleMarker)) {
        endLine = i;
        break;
      }
    }

    // 提取内容并过滤空行
    return lines.slice(startLine + 1, endLine).join('\n').trim();
  }

  // 生成 AI 评价
  async generateReview(content: string, editor: Editor, fileContent: string, titleStartIndex: number, mode: 'day' | 'week' = 'day', contextType: string = '') {
    if (!this.settings.apiKey) {
      new Notice('请先在设置中配置 API Key');
      return;
    }

    if (!content) {
      new Notice('未找到可分析的内容');
      return;
    }

    // 显示处理中提示
    const notice = new Notice('加缪正在凝视你的推石历程...', 0);

    try {
      // 根据模式选择提示词并替换字数限制占位符
      let systemPrompt = mode === 'day' ? this.settings.daySystemPrompt : this.settings.weekSystemPrompt;
      const wordLimit = mode === 'day' ? this.settings.dayWordLimit : this.settings.weekWordLimit;
      systemPrompt = systemPrompt.replace(/\{\{WORD_LIMIT\}\}/g, wordLimit.toString());

      // 调用 AI API
      const aiResponse = await this.callAIAPI(content, systemPrompt);
      notice.hide();

      // 生成 Callout 内容
      const calloutTitle = mode === 'day' ? '今日审视' : '本周审视';
      const callout = `> [!quote]- ⛰️ 西西弗斯的${calloutTitle}
> ${aiResponse.replace(/\n/g, '\n> ')}
>
> — *"人们必须想象西西弗斯是快乐的。"* ^sisyphus-reflection`;

      // 插入到正确位置
      this.insertCallout(callout, editor, fileContent, titleStartIndex);
    } catch (error) {
      notice.hide();
      if (error instanceof Error) {
        new Notice(`生成评价失败：${error.message}`);
      } else {
        new Notice('生成评价失败，请检查设置和网络连接');
      }
    }
  }

  // 调用 AI API
  async callAIAPI(content: string, systemPrompt: string): Promise<string> {
    // 准备请求数据
    const requestData = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.7
    };

    // 实现重试机制
    for (let attempt = 0; attempt < this.settings.retryCount; attempt++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), this.settings.timeout);
        });

        // 发送请求
        const response = await Promise.race([
          requestUrl({
            url: this.settings.apiBaseUrl,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify(requestData)
          }),
          timeoutPromise
        ]);

        if ('status' in response && response.status === 200) {
          const data = response.json;
          return data.choices[0].message.content.trim();
        } else {
          throw new Error(`API 响应错误：${'status' in response ? response.status : '未知错误'}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message === '请求已取消') {
          throw error;
        }
        if (attempt === this.settings.retryCount - 1) {
          throw error;
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('API 调用失败');
  }

  // 插入 Callout 到正确位置
  insertCallout(callout: string, editor: Editor, fileContent: string, titleStartIndex: number) {
    const lines = fileContent.split('\n');
    let startLine = -1;
    let endLine = lines.length;

    // 找到标题行
    for (let i = 0; i < lines.length; i++) {
      if (fileContent.substring(0, titleStartIndex).split('\n').length - 1 === i) {
        startLine = i;
        break;
      }
    }

    if (startLine === -1) {
      return;
    }

    // 找到标题块的结束行
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#') && !line.startsWith('##')) {
        endLine = i;
        break;
      }
    }

    // 检查是否已有 Callout
    const titleBlockContent = lines.slice(startLine, endLine).join('\n');
    const existingCalloutRegex = /> \[!quote]- ⛰️ 西西弗斯的(今日审视|本周审视)[\s\S]*?\^sisyphus-reflection/gm;
    const existingCalloutMatch = existingCalloutRegex.exec(titleBlockContent);

    if (existingCalloutMatch) {
      // 显示确认模态框
      new ReplaceCalloutModal(this.app, {
        onReplace: () => {
          // 替换已有 Callout
          const newContent = titleBlockContent.replace(existingCalloutRegex, callout);
          const newLines = [...lines.slice(0, startLine), ...newContent.split('\n'), ...lines.slice(endLine)];
          editor.setValue(newLines.join('\n'));
          // 滚动到插入位置
          this.scrollToCallout(editor, newContent, startLine);
        },
        onCreateNew: () => {
          // 添加新的 Callout
          const newContent = `${titleBlockContent}\n\n${callout}`;
          const newLines = [...lines.slice(0, startLine), ...newContent.split('\n'), ...lines.slice(endLine)];
          editor.setValue(newLines.join('\n'));
          // 滚动到插入位置
          this.scrollToCallout(editor, newContent, startLine);
        }
      }).open();
    } else {
      // 直接添加 Callout
      const newContent = `${titleBlockContent}\n\n${callout}`;
      const newLines = [...lines.slice(0, startLine), ...newContent.split('\n'), ...lines.slice(endLine)];
      editor.setValue(newLines.join('\n'));
      // 滚动到插入位置
      this.scrollToCallout(editor, newContent, startLine);
    }
  }

  // 滚动到 Callout 位置
  scrollToCallout(editor: Editor, content: string, startLine: number) {
    const calloutLine = content.split('\n').findIndex(line => line.startsWith('> [!quote]- ⛰️ 西西弗斯的审视'));
    if (calloutLine !== -1) {
      const absoluteLine = startLine + calloutLine;
      const cursor = { line: absoluteLine, ch: 0 };
      editor.setCursor(cursor);
      editor.scrollIntoView({ from: cursor, to: cursor }, true);
    }
  }

  // 取消当前请求
  cancelRequest() {
    // 由于使用 Promise.race 处理超时，取消请求的功能需要重新实现
    // 这里可以添加一个标志来标记请求已取消
    new Notice('请求已取消');
  }

  // 加载设置
  async loadSettings() {
    const savedSettings = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);

    // 确保新字段存在（向后兼容）
    if (!this.settings.daySystemPrompt) {
      this.settings.daySystemPrompt = DEFAULT_SETTINGS.daySystemPrompt;
    }
    if (!this.settings.weekSystemPrompt) {
      this.settings.weekSystemPrompt = DEFAULT_SETTINGS.weekSystemPrompt;
    }
    if (!this.settings.dayWordLimit) {
      this.settings.dayWordLimit = DEFAULT_SETTINGS.dayWordLimit;
    }
    if (!this.settings.weekWordLimit) {
      this.settings.weekWordLimit = DEFAULT_SETTINGS.weekWordLimit;
    }
  }

  // 保存设置
  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // 清理资源
    this.cancelRequest();
  }
}

// 设置页面类
class SisyphusReviewSettingTab extends PluginSettingTab {
  plugin: SisyphusReviewPlugin;

  constructor(app: App, plugin: SisyphusReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Sisyphus Review 设置' });

    // API Key 设置
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('DeepSeek API Key')
      .addTextArea(text => {
        text.setPlaceholder('输入你的 DeepSeek API Key');
        text.setValue(this.plugin.settings.apiKey);
        text.onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        });
        const inputEl = text.inputEl;
        if (inputEl) {
          inputEl.setAttribute('type', 'password');
          inputEl.setAttribute('spellcheck', 'false');
        }
        return text;
      });

    // API Base URL 设置
    new Setting(containerEl)
      .setName('API Base URL')
      .setDesc('DeepSeek API 地址')
      .addText(text => text
        .setPlaceholder('https://api.deepseek.com/v1/chat/completions')
        .setValue(this.plugin.settings.apiBaseUrl)
        .onChange(async (value) => {
          this.plugin.settings.apiBaseUrl = value;
          await this.plugin.saveSettings();
        }));

    // 每日提示词设置
    new Setting(containerEl)
      .setName('每日提示词')
      .setDesc('用于每日总结的系统提示词，语言风格激烈、冒犯，字数限制150字')
      .addTextArea(text => text
        .setPlaceholder('输入自定义每日提示词')
        .setValue(this.plugin.settings.daySystemPrompt)
        .onChange(async (value) => {
          this.plugin.settings.daySystemPrompt = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.height = '150px');

    // 每周提示词设置
    new Setting(containerEl)
      .setName('每周提示词')
      .setDesc('用于每周总结的系统提示词，语言风格激烈、冒犯')
      .addTextArea(text => text
        .setPlaceholder('输入自定义每周提示词')
        .setValue(this.plugin.settings.weekSystemPrompt)
        .onChange(async (value) => {
          this.plugin.settings.weekSystemPrompt = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.height = '150px');

    // 每日字数限制设置
    new Setting(containerEl)
      .setName('每日总结字数限制')
      .setDesc('控制每日总结的最大字数')
      .addText(text => text
        .setPlaceholder('150')
        .setValue(this.plugin.settings.dayWordLimit.toString())
        .onChange(async (value) => {
          const dayWordLimit = parseInt(value);
          if (!isNaN(dayWordLimit) && dayWordLimit > 0) {
            this.plugin.settings.dayWordLimit = dayWordLimit;
            await this.plugin.saveSettings();
          }
        }));

    // 每周字数限制设置
    new Setting(containerEl)
      .setName('每周总结字数限制')
      .setDesc('控制每周总结的最大字数')
      .addText(text => text
        .setPlaceholder('300')
        .setValue(this.plugin.settings.weekWordLimit.toString())
        .onChange(async (value) => {
          const weekWordLimit = parseInt(value);
          if (!isNaN(weekWordLimit) && weekWordLimit > 0) {
            this.plugin.settings.weekWordLimit = weekWordLimit;
            await this.plugin.saveSettings();
          }
        }));

    // 高级选项折叠面板
    const advancedSettings = containerEl.createEl('div');
    const advancedToggle = new Setting(containerEl)
      .setName('高级选项')
      .setDesc('超时设置和重试次数')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          if (value) {
            advancedSettings.style.display = 'block';
          } else {
            advancedSettings.style.display = 'none';
          }
        }));

    advancedSettings.style.display = 'none';

    // 超时设置
    new Setting(advancedSettings)
      .setName('请求超时')
      .setDesc('API 请求超时时间（毫秒）')
      .addText(text => text
        .setPlaceholder('30000')
        .setValue(this.plugin.settings.timeout.toString())
        .onChange(async (value) => {
          const timeout = parseInt(value);
          if (!isNaN(timeout)) {
            this.plugin.settings.timeout = timeout;
            await this.plugin.saveSettings();
          }
        }));

    // 重试次数设置
    new Setting(advancedSettings)
      .setName('重试次数')
      .setDesc('API 请求失败后重试次数')
      .addText(text => text
        .setPlaceholder('3')
        .setValue(this.plugin.settings.retryCount.toString())
        .onChange(async (value) => {
          const retryCount = parseInt(value);
          if (!isNaN(retryCount) && retryCount >= 0) {
            this.plugin.settings.retryCount = retryCount;
            await this.plugin.saveSettings();
          }
        }));
  }
}

// 替换 Callout 确认模态框
class ReplaceCalloutModal extends Modal {
  options: {
    onReplace: () => void;
    onCreateNew: () => void;
  };

  constructor(app: App, options: {
    onReplace: () => void;
    onCreateNew: () => void;
  }) {
    super(app);
    this.options = options;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: '替换现有评价' });
    contentEl.createEl('p', { text: '该日记已经有一个西西弗斯的审视评价。你想替换它还是创建一个新的？' });

    const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });

    const replaceBtn = buttonContainer.createEl('button', { text: '替换现有评价', cls: 'mod-cta' });
    replaceBtn.addEventListener('click', () => {
      this.options.onReplace();
      this.close();
    });

    const createNewBtn = buttonContainer.createEl('button', { text: '创建新评价', cls: 'mod-cta' });
    createNewBtn.addEventListener('click', () => {
      this.options.onCreateNew();
      this.close();
    });

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
