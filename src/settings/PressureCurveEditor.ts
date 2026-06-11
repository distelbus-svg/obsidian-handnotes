import { App } from 'obsidian';
import { PressureCurveConfig } from '../types';
import { monotoneCubicSpline } from '../canvas/PressureCurve';

export class PressureCurveEditor {
  private container: HTMLElement;
  private config: PressureCurveConfig;
  private onChange: (config: PressureCurveConfig) => void;
  private graphCanvas: HTMLCanvasElement;
  private testCanvas: HTMLCanvasElement;
  private graphCtx: CanvasRenderingContext2D;
  private testCtx: CanvasRenderingContext2D;
  private draggingIndex: number | null = null;
  private testPoints: { x: number; y: number }[] = [];
  private isDrawingTest = false;

  constructor(
    container: HTMLElement,
    config: PressureCurveConfig,
    onChange: (config: PressureCurveConfig) => void
  ) {
    this.container = container;
    this.config = JSON.parse(JSON.stringify(config));
    this.onChange = onChange;
    this.graphCanvas = document.createElement('canvas');
    this.testCanvas = document.createElement('canvas');
    this.graphCtx = this.graphCanvas.getContext('2d')!;
    this.testCtx = this.testCanvas.getContext('2d')!;
    this.build();
    this.renderGraph();
  }

  private build(): void {
    const wrapper = this.container.createDiv({ cls: 'handnotes-curve-editor' });

    const graphSection = wrapper.createDiv({ cls: 'handnotes-curve-graph-section' });
    graphSection.createEl('h3', { text: 'Pressure Curve' });

    this.graphCanvas.width = 300;
    this.graphCanvas.height = 300;
    this.graphCanvas.addClass('handnotes-curve-canvas');
    graphSection.appendChild(this.graphCanvas);

    const btnRow = graphSection.createDiv({ cls: 'handnotes-curve-buttons' });
    const deleteBtn = btnRow.createEl('button', { text: 'Delete Handle', cls: 'mod-warning' });
    deleteBtn.addEventListener('click', () => this.deleteSelectedHandle());
    const resetBtn = btnRow.createEl('button', { text: 'Reset', cls: 'mod-cta' });
    resetBtn.addEventListener('click', () => this.resetCurve());

    const testSection = wrapper.createDiv({ cls: 'handnotes-curve-test-section' });
    testSection.createEl('h3', { text: 'Test Area' });
    this.testCanvas.width = 200;
    this.testCanvas.height = 200;
    this.testCanvas.addClass('handnotes-curve-test-canvas');
    testSection.appendChild(this.testCanvas);

    this.setupGraphEvents();
    this.setupTestEvents();
  }

  private setupGraphEvents(): void {
    this.graphCanvas.addEventListener('mousedown', (e) => {
      const rect = this.graphCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / this.graphCanvas.width;
      const my = 1 - (e.clientY - rect.top) / this.graphCanvas.height;

      for (let i = 0; i < this.config.points.length; i++) {
        const p = this.config.points[i];
        const px = p.x;
        const py = p.y;
        const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < 0.04) {
          this.draggingIndex = i;
          return;
        }
      }

      if (mx > 0.05 && mx < 0.95 && my > 0.05 && my < 0.95) {
        const insertAt = this.config.points.findIndex(p => p.x > mx);
        if (insertAt === -1) {
          this.config.points.push({ x: mx, y: my });
          this.draggingIndex = this.config.points.length - 1;
        } else {
          this.config.points.splice(insertAt, 0, { x: mx, y: my });
          this.draggingIndex = insertAt;
        }
        this.renderGraph();
        this.emitChange();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.draggingIndex === null) return;
      const rect = this.graphCanvas.getBoundingClientRect();
      let mx = (e.clientX - rect.left) / this.graphCanvas.width;
      let my = 1 - (e.clientY - rect.top) / this.graphCanvas.height;
      mx = Math.max(0, Math.min(1, mx));
      my = Math.max(0, Math.min(1, my));

      const idx = this.draggingIndex;
      if (idx <= 0 || idx >= this.config.points.length - 1) return;

      const prev = this.config.points[idx - 1];
      const next = this.config.points[idx + 1];
      if (mx <= prev.x || mx >= next.x) return;

      this.config.points[idx] = { x: mx, y: my };
      this.renderGraph();
      this.emitChange();
    });

    window.addEventListener('mouseup', () => {
      this.draggingIndex = null;
    });
  }

  private setupTestEvents(): void {
    this.testCanvas.addEventListener('pointerdown', (e: PointerEvent) => {
      this.isDrawingTest = true;
      this.testPoints = [];
      const rect = this.testCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.testPoints.push({ x, y });
    });

    this.testCanvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDrawingTest) return;
      const rect = this.testCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.testPoints.push({ x, y });
      this.renderTest();
    });

    this.testCanvas.addEventListener('pointerup', () => {
      this.isDrawingTest = false;
    });

    this.testCanvas.addEventListener('pointerleave', () => {
      this.isDrawingTest = false;
    });
  }

  private renderGraph(): void {
    const ctx = this.graphCtx;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, w, h);

    const pad = 20;
    const gw = w - pad * 2;
    const gh = h - pad * 2;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= 4; i++) {
      const x = pad + (gw * i) / 4;
      const y = pad + (gh * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, pad + gh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + gw, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(pad, pad, gw, gh);

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', pad, pad + gh + 14);
    ctx.fillText('0.5', pad + gw / 2, pad + gh + 14);
    ctx.fillText('1', pad + gw, pad + gh + 14);
    ctx.textAlign = 'right';
    ctx.fillText('0', pad - 4, pad + gh + 4);
    ctx.fillText('0.5', pad - 4, pad + gh / 2 + 4);
    ctx.fillText('1', pad - 4, pad + 4);

    if (this.config.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;

      const steps = 100;
      const sorted = [...this.config.points].sort((a, b) => a.x - b.x);
      const interpolator = monotoneCubicSpline(sorted);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = interpolator(t);
        const px = pad + t * gw;
        const py = pad + (1 - y) * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const cx = pad + p.x * gw;
        const cy = pad + (1 - p.y) * gh;
        ctx.fillStyle = (i === 0 || i === sorted.length - 1) ? '#888' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(cx, cy, i === this.draggingIndex ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (i > 0 && i < sorted.length - 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        }
      }
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Raw pressure →', 5, 12);
    ctx.save();
    ctx.translate(8, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output pressure ←', 0, 0);
    ctx.restore();
  }

  private renderTest(): void {
    const ctx = this.testCtx;
    const w = this.testCanvas.width;
    const h = this.testCanvas.height;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    if (this.testPoints.length < 2) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const interpolator = this.config.points.length >= 2
      ? monotoneCubicSpline(this.config.points.sort((a, b) => a.x - b.x))
      : (t: number) => t;

    const pressureFn = (raw: number): number => {
      return interpolator(Math.max(0, Math.min(1, raw)));
    };

    ctx.moveTo(this.testPoints[0].x, this.testPoints[0].y);

    for (let i = 1; i < this.testPoints.length; i++) {
      const dx = this.testPoints[i].x - this.testPoints[i - 1].x;
      const dy = this.testPoints[i].y - this.testPoints[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rawPressure = Math.min(1, dist / 10);
      const pressure = pressureFn(rawPressure);
      const lineW = 1 + pressure * 4;
      ctx.lineWidth = lineW;
      ctx.lineTo(this.testPoints[i].x, this.testPoints[i].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.testPoints[i].x, this.testPoints[i].y);
    }
  }

  private deleteSelectedHandle(): void {
    if (this.config.points.length <= 2) return;
    if (this.draggingIndex !== null && this.draggingIndex > 0 && this.draggingIndex < this.config.points.length - 1) {
      this.config.points.splice(this.draggingIndex, 1);
      this.draggingIndex = null;
      this.renderGraph();
      this.emitChange();
    }
  }

  private resetCurve(): void {
    this.config.points = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.2 },
      { x: 0.7, y: 0.8 },
      { x: 1, y: 1 },
    ];
    this.draggingIndex = null;
    this.renderGraph();
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange(JSON.parse(JSON.stringify(this.config)));
  }

  getConfig(): PressureCurveConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  setConfig(config: PressureCurveConfig): void {
    this.config = JSON.parse(JSON.stringify(config));
    this.renderGraph();
  }
}
