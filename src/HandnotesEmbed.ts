import { App, MarkdownPostProcessorContext, Plugin, TFile, Notice } from 'obsidian';
import { HandwritingCanvas } from './canvas/Canvas';
import { HandnotesFile, PluginSettings } from './types';

export function registerHandnotesEmbed(
  plugin: Plugin,
  app: App,
  getSettings: () => PluginSettings
): void {
  plugin.registerMarkdownCodeBlockProcessor('handnotes', async (
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ) => {
    const filePath = source.trim();
    if (!filePath) {
      el.createEl('div', { text: '[Handnotes: no file path]', cls: 'handnotes-embed-error' });
      return;
    }

    let resolvedPath = filePath;
    const noteFile = ctx.sourcePath;
    if (!filePath.startsWith('/')) {
      const noteDir = noteFile.substring(0, noteFile.lastIndexOf('/') + 1) || '';
      resolvedPath = noteDir + filePath;
    }

    const abstractFile = app.vault.getAbstractFileByPath(resolvedPath);
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      el.createEl('div', {
        text: `[Handnotes: file not found — ${resolvedPath}]`,
        cls: 'handnotes-embed-error',
      });
      return;
    }

    el.addClass('handnotes-embed');
    const container = el.createDiv({ cls: 'handnotes-embed-canvas' });

    try {
      const content = await app.vault.read(abstractFile);
      const data: HandnotesFile = JSON.parse(content);

      const canvas = new HandwritingCanvas(container);
      canvas.fromHandnotesFile(data);
      canvas.setDarkMode(getSettings().darkModeCanvasBg);
      canvas.setSmoothing(getSettings().strokeSmoothing);
      canvas.onSaveNeeded = null;

      const resizeObserver = new ResizeObserver(() => {
        canvas.onResize();
      });
      resizeObserver.observe(container);
      plugin.register(() => resizeObserver.disconnect());

      plugin.register(() => canvas.destroy());

      el.style.minHeight = '300px';
      const updateHeight = () => {
        const rect = container.getBoundingClientRect();
        if (rect.height < 300) {
          el.style.height = '300px';
        }
      };
      updateHeight();
    } catch (err) {
      el.createEl('div', {
        text: `[Handnotes: error loading — ${err}]`,
        cls: 'handnotes-embed-error',
      });
    }
  });
}
