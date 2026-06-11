import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, ToolType, LayoutType } from '../types';
import { PressureCurveEditor } from './PressureCurveEditor';

export class HandnotesSettingTab extends PluginSettingTab {
  private plugin: Plugin;
  private settings: PluginSettings;
  private onSettingsChange: (settings: PluginSettings) => void;

  constructor(
    app: App,
    plugin: Plugin,
    settings: PluginSettings,
    onSettingsChange: (settings: PluginSettings) => void
  ) {
    super(app, plugin);
    this.plugin = plugin;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Handnotes Settings' });

    this.addApplePencilSection(containerEl);
    this.addSyncSection(containerEl);
    this.addAppearanceSection(containerEl);
    this.addPerformanceSection(containerEl);
  }

  private addApplePencilSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Apple Pencil & Stylus' });

    const curveDesc = containerEl.createDiv({ cls: 'setting-item-description' });
    curveDesc.setText(
      'Drag the blue handles to adjust the pressure response curve. ' +
      'Add new handles by clicking on the graph.'
    );

    const curveContainer = containerEl.createDiv({ cls: 'handnotes-settings-curve' });
    const curveEditor = new PressureCurveEditor(
      curveContainer,
      this.settings.pressureCurve,
      (config) => {
        this.settings.pressureCurve = config;
        this.saveSettings();
      }
    );

    new Setting(containerEl)
      .setName('Palm rejection')
      .setDesc('Only process pen/stylus events on the drawing canvas')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.palmRejection)
          .onChange(async (value) => {
            this.settings.palmRejection = value;
            await this.saveSettings();
          })
      );

    containerEl.createEl('h4', { text: 'Per-tool pressure sensitivity' });

    const tools: ToolType[] = [
      'fountain', 'ballpoint', 'pencil', 'marker',
    ];
    for (const tool of tools) {
      const label = tool.charAt(0).toUpperCase() + tool.slice(1);
      new Setting(containerEl)
        .setName(label)
        .addToggle((toggle) =>
          toggle
            .setValue(this.settings.toolPressureEnabled[tool] ?? true)
            .onChange(async (value) => {
              this.settings.toolPressureEnabled[tool] = value;
              await this.saveSettings();
            })
        );
    }
  }

  private addSyncSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Sync & Storage' });

    new Setting(containerEl)
      .setName('Asset folder name')
      .setDesc('Subfolder name for storing embedded images and PDFs beside your notes')
      .addText((text) =>
        text
          .setPlaceholder('_handnotes_assets')
          .setValue(this.settings.assetFolderName)
          .onChange(async (value) => {
            this.settings.assetFolderName = value || '_handnotes_assets';
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-save interval')
      .setDesc('How often to auto-save your drawing (in seconds)')
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.settings.autoSaveInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.settings.autoSaveInterval = value;
            await this.saveSettings();
          })
      );
  }

  private addAppearanceSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Appearance' });

    new Setting(containerEl)
      .setName('Default tool on open')
      .setDesc('Which drawing tool is selected when opening a handnote')
      .addDropdown((dropdown) => {
        const tools: { value: ToolType; label: string }[] = [
          { value: 'fountain', label: 'Fountain Pen' },
          { value: 'ballpoint', label: 'Ballpoint' },
          { value: 'pencil', label: 'Pencil' },
          { value: 'marker', label: 'Marker' },
          { value: 'eraser', label: 'Eraser' },
          { value: 'selection', label: 'Selection' },
          { value: 'pan', label: 'Pan' },
        ];
        for (const t of tools) {
          dropdown.addOption(t.value, t.label);
        }
        dropdown.setValue(this.settings.defaultTool);
        dropdown.onChange(async (value) => {
          this.settings.defaultTool = value as ToolType;
          await this.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Default page layout')
      .setDesc('Background pattern for new handnotes')
      .addDropdown((dropdown) => {
        const layouts: { value: LayoutType; label: string }[] = [
          { value: 'blank', label: 'Blank' },
          { value: 'ruled-narrow', label: 'Ruled (narrow)' },
          { value: 'ruled-wide', label: 'Ruled (wide)' },
          { value: 'grid-small', label: 'Grid (small)' },
          { value: 'grid-large', label: 'Grid (large)' },
          { value: 'dot', label: 'Dot grid' },
          { value: 'isometric', label: 'Isometric' },
        ];
        for (const l of layouts) {
          dropdown.addOption(l.value, l.label);
        }
        dropdown.setValue(this.settings.defaultLayout);
        dropdown.onChange(async (value) => {
          this.settings.defaultLayout = value as LayoutType;
          await this.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Dark mode canvas background')
      .setDesc('Use dark background for the drawing canvas')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.darkModeCanvasBg)
          .onChange(async (value) => {
            this.settings.darkModeCanvasBg = value;
            await this.saveSettings();
          })
      );
  }

  private addPerformanceSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Performance' });

    new Setting(containerEl)
      .setName('Stroke smoothing')
      .setDesc('Amount of rolling-average smoothing applied to raw pointer input (0 = none, 100 = maximum)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.settings.strokeSmoothing)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.settings.strokeSmoothing = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Max undo history')
      .setDesc('Maximum number of undo steps to keep in memory')
      .addText((text) =>
        text
          .setValue(String(this.settings.maxUndoHistory))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.settings.maxUndoHistory = num;
              await this.saveSettings();
            }
          })
      );
  }

  private async saveSettings(): Promise<void> {
    await this.plugin.saveData(this.settings);
    this.onSettingsChange(this.settings);
  }
}
