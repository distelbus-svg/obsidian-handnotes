import { App, Vault, TFile, Notice } from 'obsidian';
import { AssetRef } from '../types';

export class AssetManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  getAssetFolderPath(notePath: string, folderName: string): string {
    const noteDir = notePath.substring(0, notePath.lastIndexOf('/') + 1) || '';
    return `${noteDir}${folderName}`;
  }

  async ensureAssetFolder(notePath: string, folderName: string): Promise<string> {
    const folderPath = this.getAssetFolderPath(notePath, folderName);
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
    return folderPath;
  }

  async importImage(
    notePath: string,
    folderName: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<AssetRef | null> {
    try {
      const folder = await this.ensureAssetFolder(notePath, folderName);
      const uniqueName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = `${folder}/${uniqueName}`;

      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (!existing) {
        await this.app.vault.createBinary(filePath, data);
      }

      return {
        id: `asset_${Date.now()}`,
        type: 'image',
        path: filePath,
        x: 0,
        y: 0,
        width: 400,
        height: 300,
      };
    } catch (err) {
      new Notice(`Failed to import image: ${err}`);
      return null;
    }
  }

  async importPdf(
    notePath: string,
    folderName: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<AssetRef[]> {
    try {
      const folder = await this.ensureAssetFolder(notePath, folderName);
      const uniqueName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = `${folder}/${uniqueName}`;

      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (!existing) {
        await this.app.vault.createBinary(filePath, data);
      }

      const asset: AssetRef = {
        id: `asset_${Date.now()}`,
        type: 'pdf',
        path: filePath,
        x: 0,
        y: 0,
        width: 600,
        height: 800,
      };

      return [asset];
    } catch (err) {
      new Notice(`Failed to import PDF: ${err}`);
      return [];
    }
  }

  async readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        return await this.app.vault.readBinary(file);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getAssetUrl(assetPath: string): Promise<string | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(assetPath);
      if (file instanceof TFile) {
        const resourcePath = this.app.vault.getResourcePath(file);
        return resourcePath;
      }
      return null;
    } catch {
      return null;
    }
  }
}
