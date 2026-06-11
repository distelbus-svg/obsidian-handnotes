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

const TOOL_SVGS: Record<string, string> = {
  fountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2l4 4-8 10h-4l-4-4 8-10z"/><path d="M12 16v-4"/><path d="M8 12l-4 4 2 2 4-4"/><path d="M16 12l4 4-2 2-4-4"/></svg>',
  ballpoint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-9 9h-4l-4-4 9-9z"/><path d="M5 16l-2 5 5-2"/><circle cx="19" cy="5" r="1"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-9 9h-4l-4-4 9-9z"/><path d="M5 16l-2 5 5-2"/></svg>',
  marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l6 6-3 3-6-6 3-3z"/><path d="M9 9l-6 6 2 2 6-6"/><path d="M3 15l2 2-2 3 3-2 2 2"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H6l-4-4L13 3l7 7-4 4"/><path d="M15.5 5.5l3 3"/><path d="M6 20l4-4"/></svg>',
  selection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 8-6 2-2 6-8-16z"/><path d="M11 13l5 5"/></svg>',
  pan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.21 0-4.21-.9-5.66-2.34L3.5 15.5a1.5 1.5 0 012.12-2.12l2.38 2.38"/></svg>',
};

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
      { type: 'fountain', icon: 'fountain', label: 'Fountain Pen' },
      { type: 'ballpoint', icon: 'ballpoint', label: 'Ballpoint' },
      { type: 'pencil', icon: 'pencil', label: 'Pencil' },
      { type: 'marker', icon: 'marker', label: 'Marker' },
      { type: 'eraser', icon: 'eraser', label: 'Eraser' },
      { type: 'selection', icon: 'selection', label: 'Select' },
      { type: 'pan', icon: 'pan', label: 'Pan' },
    ];

    const btnGroup = this.container.createDiv({ cls: 'handnotes-tb-buttons' });

    for (const t of tools) {
      const btn = btnGroup.createEl('button', {
        cls: 'handnotes-tb-btn',
        attr: { 'data-tool': t.type, 'title': t.label },
      });
      btn.innerHTML = TOOL_SVGS[t.type] || '';
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

    let hue = 0, saturation = 100, lightness = 50;

    const hueContainer = colorRow.createDiv({ cls: 'handnotes-popup-hue' });
    const hueCanvas = hueContainer.createEl('canvas', { attr: { width: 200, height: 16 } });
    this.drawHueGradient(hueCanvas);
    this.drawHueCursor(hueCanvas, hue);

    const satLightContainer = colorRow.createDiv({ cls: 'handnotes-popup-sat-light' });
    const slCanvas = satLightContainer.createEl('canvas', { attr: { width: 180, height: 150 } });
    this.drawSLGradient(slCanvas, hue);
    this.drawSLCursor(slCanvas, saturation, lightness);

    const previewContainer = colorRow.createDiv({ cls: 'handnotes-popup-preview' });
    const preview = previewContainer.createEl('canvas', { attr: { width: 40, height: 40 } });
    this.updatePreviewColor(preview, hue, saturation, lightness);

    const setupDrag = (
      canvas: HTMLCanvasElement,
      onMove: (clientX: number, clientY: number) => void
    ) => {
      let dragging = false;
      const handle = (clientX: number, clientY: number) => {
        onMove(clientX, clientY);
        this.drawHueGradient(hueCanvas);
        this.drawHueCursor(hueCanvas, hue);
        this.drawSLGradient(slCanvas, hue);
        this.drawSLCursor(slCanvas, saturation, lightness);
        this.updatePreviewColor(preview, hue, saturation, lightness);
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        this.currentColor = color;
        this.callbacks.onColorChange(color);
        this.updateWidthPreview(el);
      };
      canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        canvas.setPointerCapture(e.pointerId);
        handle(e.clientX, e.clientY);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        handle(e.clientX, e.clientY);
      });
      canvas.addEventListener('pointerup', () => { dragging = false; });
      canvas.addEventListener('pointercancel', () => { dragging = false; });
    };

    setupDrag(hueCanvas, (clientX) => {
      const r = hueCanvas.getBoundingClientRect();
      hue = Math.max(0, Math.min(360, ((clientX - r.left) / r.width) * 360));
    });

    setupDrag(slCanvas, (clientX, clientY) => {
      const r = slCanvas.getBoundingClientRect();
      saturation = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
      lightness = Math.max(0, Math.min(100, ((1 - (clientY - r.top) / r.height) * 100)));
    });

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

    widthSlider.addEventListener('input', () => {
      const val = parseFloat(widthSlider.value);
      this.currentWidth = val;
      widthSection.querySelector('label')!.textContent = `Width: ${val}`;
      this.callbacks.onWidthChange(val);
      this.updateWidthPreview(el);
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

  private updateWidthPreview(el: HTMLElement): void {
    const cv = el.querySelector('.handnotes-popup-section canvas:not(.handnotes-popup-preview canvas):not(.handnotes-popup-hue canvas):not(.handnotes-popup-sat-light canvas)') as HTMLCanvasElement;
    if (cv) this.drawWidthPreview(cv, this.currentColor, this.currentWidth);
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

  private drawHueCursor(canvas: HTMLCanvasElement, hue: number): void {
    const ctx = canvas.getContext('2d')!;
    const x = (hue / 360) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 5, 5);
    ctx.lineTo(x + 5, 5);
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x - 5, canvas.height - 5);
    ctx.lineTo(x + 5, canvas.height - 5);
    ctx.closePath();
    ctx.fill();
  }

  private drawSLGradient(canvas: HTMLCanvasElement, hue: number): void {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (x / w) * 100;
        const l = (1 - y / h) * 100;
        const rgb = this.hslToRgb(hue / 360, s / 100, l / 100);
        const i = (y * w + x) * 4;
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  private drawSLCursor(canvas: HTMLCanvasElement, saturation: number, lightness: number): void {
    const ctx = canvas.getContext('2d')!;
    const cx = (saturation / 100) * canvas.width;
    const cy = (1 - lightness / 100) * canvas.height;
    const invL = lightness > 50 ? 0 : 255;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgb(${invL},${invL},${invL})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgb(${255 - invL},${255 - invL},${255 - invL})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private updateColorDisplay(el: HTMLElement, h: number, s: number, l: number): void {
    const color = `hsl(${h}, ${s}%, ${l}%)`;
    this.currentColor = color;
    this.callbacks.onColorChange(color);

    const preview = el.querySelector('.handnotes-popup-preview canvas') as HTMLCanvasElement;
    if (preview) this.updatePreviewColor(preview, h, s, l);

    this.updateWidthPreview(el);
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
