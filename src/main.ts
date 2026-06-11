import { Plugin, WorkspaceLeaf, addIcon, Notice, Platform } from 'obsidian';
import { HandnotesView, VIEW_TYPE } from './HandnotesView';
import { registerHandnotesEmbed } from './HandnotesEmbed';
import { HandnotesSettingTab } from './settings/SettingsTab';
import {
  PluginSettings, DEFAULT_SETTINGS, HandnotesFile,
} from './types';

const HANDNOTES_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20 80 L35 25 L50 45 L65 20 L80 75" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="35" cy="25" r="4" fill="currentColor"/>
  <circle cx="65" cy="20" r="4" fill="currentColor"/>
</svg>
`;

export default class HandnotesPlugin extends Plugin {
  private pluginSettings: PluginSettings = DEFAULT_SETTINGS;
  private viewInstances: Map<string, HandnotesView> = new Map();

  async onload(): Promise<void> {
    await this.loadSettings();

    addIcon('handnotes-pen', HANDNOTES_ICON);

    this.registerView(
      VIEW_TYPE,
      (leaf) => new HandnotesView(leaf, this.app, this.pluginSettings)
    );

    registerHandnotesEmbed(this, this.app, () => this.pluginSettings);

    this.addSettingTab(
      new HandnotesSettingTab(this.app, this, this.pluginSettings, (newSettings) => {
        this.pluginSettings = newSettings;
        this.updateAllViews();
      })
    );

    this.addCommand({
      id: 'open-handnotes-file',
      name: 'Open .hn file',
      callback: () => this.openHandnotesFile(),
    });

    this.addCommand({
      id: 'new-handnote',
      name: 'Create new handnote',
      callback: () => this.createNewHandnote(),
    });

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.onLayoutChange();
      })
    );

    if (Platform.isIosApp || Platform.isAndroidApp) {
      this.registerDomEvent(document, 'touchstart', (e) => {
      }, { passive: true });
    }

    this.addRibbonIcon('handnotes-pen', 'New Handnote', () => {
      this.createNewHandnote();
    });

    this.registerExtensions(['hn'], VIEW_TYPE);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  private async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.pluginSettings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async savePluginSettings(): Promise<void> {
    await this.saveData(this.pluginSettings);
  }

  private updateAllViews(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof HandnotesView) {
        view.updateSettings(this.pluginSettings);
      }
    });
  }

  private onLayoutChange(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof HandnotesView) {
        view.onResize();
      }
    });
  }

  private async openHandnotesFile(): Promise<void> {
    const files = this.app.vault.getFiles().filter(f => f.extension === 'hn');
    if (files.length === 0) {
      new Notice('No .hn files found in vault');
      return;
    }

    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
      || this.app.workspace.getRightLeaf(false);

    if (!leaf) {
      new Notice('Cannot open leaf');
      return;
    }

    await leaf.setViewState({
      type: VIEW_TYPE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }

  private async createNewHandnote(): Promise<void> {
    const folder = this.app.vault.getRoot();
    const baseName = 'Untitled';
    let fileName = `${baseName}.hn`;
    let counter = 1;
    while (await this.app.vault.adapter.exists(fileName)) {
      fileName = `${baseName} ${counter}.hn`;
      counter++;
    }

    const defaultFile: HandnotesFile = {
      version: 1,
      strokes: [],
      assets: [],
      state: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        background: this.pluginSettings.defaultLayout,
      },
    };

    await this.app.vault.create(fileName, JSON.stringify(defaultFile, null, 2));

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);

    const view = leaf.view;
    if (view instanceof HandnotesView) {
      await view.loadFile(fileName);
    }

    new Notice(`Created ${fileName}`);
  }
}
