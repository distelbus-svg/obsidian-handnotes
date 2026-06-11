import { ItemView, WorkspaceLeaf, App, Notice, TFile, Platform } from 'obsidian';
import { HandwritingCanvas } from './canvas/Canvas';
import { Toolbar, ToolbarCallbacks } from './ui/Toolbar';
import { LayoutPicker } from './ui/LayoutPicker';
import { AssetManager } from './assets/AssetManager';
import { HandnotesFile, ToolType, PluginSettings } from './types';

export const VIEW_TYPE = 'handnotes-view';

export class HandnotesView extends ItemView {
  private canvas: HandwritingCanvas | null = null;
  private toolbar: Toolbar | null = null;
  private layoutPicker: LayoutPicker | null = null;
  private assetManager: AssetManager;
  private filePath: string = '';
  private saveTimer: number | null = null;
  private settings: PluginSettings;
  private toolbarEl!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private topBarEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, app: App, settings: PluginSettings) {
    super(leaf);
    this.assetManager = new AssetManager(app);
    this.settings = settings;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.filePath ? this.filePath.split('/').pop() || 'Handnote' : 'Handnote';
  }

  getIcon(): string {
    return 'pen';
  }

  async onOpen(): Promise<void> {
    const contentEl = this.contentEl;
    contentEl.empty();
    contentEl.addClass('handnotes-view');

    this.topBarEl = contentEl.createDiv({ cls: 'handnotes-topbar' });
    this.canvasContainer = contentEl.createDiv({ cls: 'handnotes-canvas-container' });
    this.toolbarEl = contentEl.createDiv({ cls: 'handnotes-toolbar-container' });

    this.layoutPicker = new LayoutPicker(this.topBarEl, (layout) => {
      if (this.canvas) {
        this.canvas.setLayout(layout);
        this.scheduleSave();
      }
    });

    const callbacks: ToolbarCallbacks = {
      onToolChange: (tool: ToolType) => this.canvas?.setTool(tool),
      onColorChange: (color: string) => this.canvas?.setColor(color),
      onWidthChange: (width: number) => this.canvas?.setWidth(width),
      onOpacityChange: (opacity: number) => this.canvas?.setOpacity(opacity),
      onUndo: () => this.canvas?.undo(),
      onRedo: () => this.canvas?.redo(),
      onInsertImage: () => this.insertImage(),
      onClearAll: () => {
        this.canvas?.clearAll();
        this.scheduleSave();
      },
    };

    this.toolbar = new Toolbar(this.toolbarEl, this.app, callbacks);

    this.canvas = new HandwritingCanvas(this.canvasContainer);
    this.canvas.onSaveNeeded = () => this.scheduleSave();
    this.canvas.onStrokeAdded = () => {};

    this.applySettings();

    if (this.filePath) {
      await this.loadFile(this.filePath);
    }

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.canvas?.onResize();
      })
    );

    if (Platform.isIosApp || Platform.isAndroidApp) {
      this.canvas?.setPalmRejection(true);
    }
  }

  async onClose(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveFile();
    this.canvas?.destroy();
  }

  async loadFile(path: string): Promise<void> {
    this.filePath = path;
    if (!this.canvas) return;

    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        new Notice('File not found');
        return;
      }
      const content = await this.app.vault.read(file);
      const data: HandnotesFile = JSON.parse(content);
      this.migrateFile(data);
      this.canvas.fromHandnotesFile(data);
      this.layoutPicker?.setLayout(data.state?.background || this.settings.defaultLayout);
    } catch (err) {
      new Notice(`Failed to load handnote: ${err}`);
    }
  }

  private migrateFile(file: HandnotesFile): void {
    if (!file.version || file.version < 1) {
      file.version = 1;
    }
    if (!file.state) {
      file.state = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        background: this.settings.defaultLayout,
      };
    }
    if (!file.strokes) file.strokes = [];
    if (!file.assets) file.assets = [];
  }

  private async saveFile(): Promise<void> {
    if (!this.canvas || !this.filePath) return;
    try {
      const data = this.canvas.toHandnotesFile();
      const json = JSON.stringify(data, null, 2);
      await this.app.vault.adapter.write(this.filePath, json);
    } catch (err) {
      new Notice(`Failed to save handnote: ${err}`);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    const interval = (this.settings.autoSaveInterval || 5) * 1000;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.saveFile();
    }, interval);
  }

  private applySettings(): void {
    if (!this.canvas) return;
    this.canvas.setSmoothing(this.settings.strokeSmoothing);
    this.canvas.setPalmRejection(this.settings.palmRejection);
    this.canvas.maxUndo = this.settings.maxUndoHistory;
    this.canvas.setDarkMode(this.settings.darkModeCanvasBg);
    this.canvas.setPressureCurve(this.settings.pressureCurve);

    for (const [tool, enabled] of Object.entries(this.settings.toolPressureEnabled)) {
      this.canvas.setToolPressureEnabled(tool, enabled);
    }

    this.canvas.setTool(this.settings.defaultTool);
    this.toolbar?.setTool(this.settings.defaultTool);
    this.layoutPicker?.setLayout(this.settings.defaultLayout);
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.applySettings();
  }

  private async insertImage(): Promise<void> {
    if (!this.canvas || !this.filePath) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const asset = await this.assetManager.importImage(
        this.filePath,
        this.settings.assetFolderName,
        file.name,
        buffer
      );
      if (asset) {
        this.canvas!.assets.push(asset);
        this.canvas!.loadAssets(this.canvas!.assets);
        this.scheduleSave();
      }
    };
    input.click();
  }

}
