import { App, setIcon } from 'obsidian';
import { ToolType } from '../types';

export interface ToolbarCallbacks {
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onInsertImage: () => void;
  onClearAll: () => void;
}

export class Toolbar {
  private container: HTMLElement;
  private callbacks: ToolbarCallbacks;
  private app: App;
  private activeTool: ToolType = 'fountain';
  private currentColor = '#000000';
  private currentWidth = 2;
  private currentOpacity = 1;
  private popupEl: HTMLElement | null = null;
  private collapsed = false;
  private recentColors: string[] = [
    '#000000', '#ff0000', '#0000ff', '#00aa00',
    '#ff8800', '#8800ff', '#00aaaa', '#aa00aa',
  ];

  constructor(
    container: HTMLElement,
    app: App,
    callbacks: ToolbarCallbacks
  ) {
    this.container = container;
    this.app = app;
    this.callbacks = callbacks;
    this.build();
  }

  private build(): void {
    this.container.addClass('handnotes-toolbar');

    const toggleBtn = this.container.createEl('button', {
      cls: 'handnotes-tb-toggle',
    });
    setIcon(toggleBtn, 'chevron-left');
    toggleBtn.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.container.toggleClass('handnotes-tb-collapsed', this.collapsed);
      setIcon(toggleBtn, this.collapsed ? 'chevron-right' : 'chevron-left');
    });

    const tools: { type: ToolType; icon: string; label: string }[] = [
      { type: 'fountain', icon: 'pen', label: 'Fountain Pen' },
      { type: 'ballpoint', icon: 'edit', label: 'Ballpoint' },
      { type: 'pencil', icon: 'pencil', label: 'Pencil' },
      { type: 'marker', icon: 'highlighter', label: 'Marker' },
      { type: 'eraser', icon: 'eraser', label: 'Eraser' },
      { type: 'selection', icon: 'lasso', label: 'Select' },
      { type: 'pan', icon: 'hand', label: 'Pan' },
    ];

    const btnGroup = this.container.createDiv({ cls: 'handnotes-tb-buttons' });

    for (const t of tools) {
      const btn = btnGroup.createEl('button', {
        cls: 'handnotes-tb-btn',
        attr: { 'data-tool': t.type, 'title': t.label },
      });
      setIcon(btn, t.icon);
      btn.addEventListener('click', () => this.onToolClick(t.type));
    }

    const spacer = this.container.createDiv({ cls: 'handnotes-tb-spacer' });

    const undoBtn = btnGroup.createEl('button', {
      cls: 'handnotes-tb-btn',
      attr: { title: 'Undo' },
    });
    setIcon(undoBtn, 'undo');
    undoBtn.addEventListener('click', () => this.callbacks.onUndo());

    const redoBtn = btnGroup.createEl('button', {
      cls: 'handnotes-tb-btn',
      attr: { title: 'Redo' },
    });
    setIcon(redoBtn, 'redo');
    redoBtn.addEventListener('click', () => this.callbacks.onRedo());

    const insertBtn = btnGroup.createEl('button', {
      cls: 'handnotes-tb-btn',
      attr: { title: 'Insert Image' },
    });
    setIcon(insertBtn, 'image');
    insertBtn.addEventListener('click', () => this.callbacks.onInsertImage());

    const clearBtn = btnGroup.createEl('button', {
      cls: 'handnotes-tb-btn',
      attr: { title: 'Clear All' },
    });
    setIcon(clearBtn, 'trash-2');
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all strokes?')) {
        this.callbacks.onClearAll();
      }
    });

    this.highlightActiveTool();
  }

  private onToolClick(tool: ToolType): void {
    if (tool === this.activeTool) {
      this.togglePopup();
    } else {
      this.closePopup();
      this.activeTool = tool;
      this.highlightActiveTool();
      this.callbacks.onToolChange(tool);
    }
  }

  private highlightActiveTool(): void {
    this.container.querySelectorAll('.handnotes-tb-btn[data-tool]').forEach(el => {
      el.toggleClass('is-active', (el as HTMLElement).dataset.tool === this.activeTool);
    });
  }

  private togglePopup(): void {
    if (this.popupEl && this.popupEl.isConnected) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  private openPopup(): void {
    this.closePopup();
    this.popupEl = this.container.createDiv({ cls: 'handnotes-tb-popup' });
    this.buildPopupContent(this.popupEl);
  }

  private closePopup(): void {
    if (this.popupEl) {
      this.popupEl.remove();
      this.popupEl = null;
    }
  }

  private buildPopupContent(el: HTMLElement): void {
    const colorSection = el.createDiv({ cls: 'handnotes-popup-section' });
    colorSection.createEl('label', { text: 'Color', cls: 'handnotes-popup-label' });

    const colorRow = colorSection.createDiv({ cls: 'handnotes-popup-color-row' });

    const hueContainer = colorRow.createDiv({ cls: 'handnotes-popup-hue' });
    const hueCanvas = hueContainer.createEl('canvas', { attr: { width: 200, height: 16 } });
    this.drawHueGradient(hueCanvas);
    let hue = 0;

    hueCanvas.addEventListener('click', (e) => {
      const r = hueCanvas.getBoundingClientRect();
      hue = Math.max(0, Math.min(360, ((e.clientX - r.left) / r.width) * 360));
      this.updateColorDisplay(el, hue, 100, 50);
    });

    const satLightContainer = colorRow.createDiv({ cls: 'handnotes-popup-sat-light' });
    const slCanvas = satLightContainer.createEl('canvas', { attr: { width: 180, height: 150 } });
    let saturation = 100, lightness = 50;

    const drawSL = (h: number) => {
      const ctx = slCanvas.getContext('2d')!;
      for (let s = 0; s <= 100; s++) {
        for (let l = 0; l <= 100; l++) {
          ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
          ctx.fillRect(s * 1.8, (100 - l) * 1.5, 1.8, 1.5);
        }
      }
    };
    drawSL(hue);

    slCanvas.addEventListener('click', (e) => {
      const r = slCanvas.getBoundingClientRect();
      saturation = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      lightness = Math.max(0, Math.min(100, ((1 - (e.clientY - r.top) / r.height) * 100)));
      this.updateColorDisplay(el, hue, saturation, lightness);
    });

    const previewContainer = colorRow.createDiv({ cls: 'handnotes-popup-preview' });
    const preview = previewContainer.createEl('canvas', { attr: { width: 40, height: 40 } });
    this.updatePreviewColor(preview, hue, saturation, lightness);

    const recentSection = el.createDiv({ cls: 'handnotes-popup-section' });
    recentSection.createEl('label', { text: 'Recent', cls: 'handnotes-popup-label' });
    const swatchRow = recentSection.createDiv({ cls: 'handnotes-popup-swatches' });
    for (const c of this.recentColors) {
      const swatch = swatchRow.createEl('button', {
        cls: 'handnotes-popup-swatch',
        attr: { style: `background-color: ${c}` },
      });
      swatch.addEventListener('click', () => {
        this.currentColor = c;
        this.callbacks.onColorChange(c);
        this.closePopup();
      });
    }

    const widthSection = el.createDiv({ cls: 'handnotes-popup-section' });
    widthSection.createEl('label', { text: `Width: ${this.currentWidth}`, cls: 'handnotes-popup-label' });
    const widthSlider = widthSection.createEl('input', {
      cls: 'handnotes-popup-slider',
      attr: { type: 'range', min: '0.5', max: '20', step: '0.5', value: String(this.currentWidth) },
    });
    const widthPreview = widthSection.createEl('canvas', { attr: { width: 200, height: 20 } });
    this.drawWidthPreview(widthPreview, this.currentColor, this.currentWidth);

    widthSlider.addEventListener('input', () => {
      const val = parseFloat(widthSlider.value);
      this.currentWidth = val;
      widthSection.querySelector('label')!.textContent = `Width: ${val}`;
      this.drawWidthPreview(widthPreview, this.currentColor, val);
      this.callbacks.onWidthChange(val);
    });

    if (this.activeTool === 'marker') {
      const opacitySection = el.createDiv({ cls: 'handnotes-popup-section' });
      opacitySection.createEl('label', { text: `Opacity: ${Math.round(this.currentOpacity * 100)}%`, cls: 'handnotes-popup-label' });
      const opacitySlider = opacitySection.createEl('input', {
        cls: 'handnotes-popup-slider',
        attr: { type: 'range', min: '0', max: '1', step: '0.05', value: String(this.currentOpacity) },
      });
      opacitySlider.addEventListener('input', () => {
        const val = parseFloat(opacitySlider.value);
        this.currentOpacity = val;
        opacitySection.querySelector('label')!.textContent = `Opacity: ${Math.round(val * 100)}%`;
        this.callbacks.onOpacityChange(val);
      });
    }
  }

  private drawHueGradient(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private updateColorDisplay(el: HTMLElement, h: number, s: number, l: number): void {
    const color = `hsl(${h}, ${s}%, ${l}%)`;
    this.currentColor = color;
    this.callbacks.onColorChange(color);

    const preview = el.querySelector('.handnotes-popup-preview canvas') as HTMLCanvasElement;
    if (preview) this.updatePreviewColor(preview, h, s, l);

    const widthPreview = el.querySelector('.handnotes-popup-section canvas:not(.handnotes-popup-preview canvas)') as HTMLCanvasElement;
    if (widthPreview) this.drawWidthPreview(widthPreview, color, this.currentWidth);
  }

  private updatePreviewColor(canvas: HTMLCanvasElement, h: number, s: number, l: number): void {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  private drawWidthPreview(canvas: HTMLCanvasElement, color: string, width: number): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, canvas.height / 2);
    ctx.lineTo(canvas.width - 10, canvas.height / 2);
    ctx.stroke();
  }

  setTool(tool: ToolType): void {
    this.activeTool = tool;
    this.highlightActiveTool();
    this.closePopup();
  }

  setColor(color: string): void {
    this.currentColor = color;
  }

  setWidth(width: number): void {
    this.currentWidth = width;
  }

  setOpacity(opacity: number): void {
    this.currentOpacity = opacity;
  }

  setRecentColors(colors: string[]): void {
    if (colors.length > 0) this.recentColors = colors;
  }
}
