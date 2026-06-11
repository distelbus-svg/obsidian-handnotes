import {
  Point, Stroke, ToolType, LayoutType, AssetRef,
  HandnotesFile, PressureCurveConfig,
} from '../types';
import { applyPressureCurve } from './PressureCurve';
import { renderStroke, buildStrokePath, getStrokeWidth } from '../tools/Tools';

export class HandwritingCanvas {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private committedCanvas: HTMLCanvasElement;
  private committedCtx: CanvasRenderingContext2D;

  strokes: Stroke[] = [];

  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];
  maxUndo = 50;

  activeTool: ToolType = 'fountain';
  currentColor = '#000000';
  currentWidth = 2;
  currentOpacity = 1;
  toolPressureEnabled: Record<string, boolean> = {};
  smoothing = 50;
  palmRejection = true;
  private pressureCurve: PressureCurveConfig = {
    points: [{ x: 0, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.7, y: 0.8 }, { x: 1, y: 1 }],
    clamp: true,
  };

  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  background: LayoutType = 'blank';
  darkMode = false;

  private isDrawing = false;
  private isPanning = false;
  private rawPoints: Point[] = [];

  private lastPointerPos: { x: number; y: number } | null = null;
  private rafPending = false;
  private lastDrawnSegment = 0;
  private needsFullRedraw = true;

  selectionPolygon: Point[] = [];
  selectedStrokeIds: Set<string> = new Set();
  private isSelecting = false;

  assets: AssetRef[] = [];
  private loadedImages: Map<string, HTMLImageElement> = new Map();

  private noisePattern: HTMLCanvasElement | null = null;

  onSaveNeeded: (() => void) | null = null;
  onStrokeAdded: (() => void) | null = null;

  private dpr = 1;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundResize: () => void;

  private _destroyed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.committedCanvas = document.createElement('canvas');
    this.committedCtx = this.committedCanvas.getContext('2d')!;

    this.dpr = window.devicePixelRatio || 1;

    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundResize = this.onResize.bind(this);

    this.initNoisePattern();
    this.setupEvents();
    this.ensureCanvasSize();
  }

  private setupEvents(): void {
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('pointerleave', this.boundPointerUp);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('resize', this.boundResize);
  }

  onResize(): void {
    this.ensureCanvasSize();
    this.scheduleRender();
  }

  destroy(): void {
    this._destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('pointerleave', this.boundPointerUp);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);
  }

  private getCssSize(): { w: number; h: number } {
    const rect = this.container.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  private ensureCanvasSize(): void {
    const { w, h } = this.getCssSize();
    const pw = Math.round(w * this.dpr);
    const ph = Math.round(h * this.dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    if (this.committedCanvas.width !== pw || this.committedCanvas.height !== ph) {
      this.rebuildCommittedCanvas();
    }
  }

  private canvasX(e: PointerEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return (e.clientX - rect.left - this.offsetX) / this.zoom;
  }

  private canvasY(e: PointerEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    return (e.clientY - rect.top - this.offsetY) / this.zoom;
  }

  private isPenEvent(e: PointerEvent): boolean {
    if (!this.palmRejection) return true;
    return e.pointerType === 'pen' || e.pointerType === 'mouse' || e.pointerType === 'touch';
  }

  private makePoint(e: PointerEvent): Point {
    return {
      x: this.canvasX(e),
      y: this.canvasY(e),
      pressure: applyPressureCurve(e.pressure || 0.5, this.pressureCurve),
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      t: Date.now(),
    };
  }

  private smoothingWindow(): number {
    return 1 + Math.floor((this.smoothing / 100) * 2);
  }

  private computeAngleChange(p0: Point, p1: Point, p2: Point): number {
    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 < 0.5) return 0;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 < 0.5) return 0;
    const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  private onPointerDown(e: PointerEvent): void {
    if (this._destroyed) return;
    if (!this.isPenEvent(e)) return;

    const pt = this.makePoint(e);

    if (this.activeTool === 'pan') {
      this.isPanning = true;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.activeTool === 'selection') {
      this.isSelecting = true;
      this.selectionPolygon = [pt];
      return;
    }

    if (this.activeTool === 'eraser') {
      this.eraseAt(pt.x, pt.y);
      this.isDrawing = true;
      this.rawPoints = [pt];
      return;
    }

    this.isDrawing = true;
    this.rawPoints = [pt];
    this.lastDrawnSegment = 0;
    this.canvas.setPointerCapture(e.pointerId);
    this.scheduleRender();
  }

  private onPointerMove(e: PointerEvent): void {
    if (this._destroyed) return;
    if (!this.isPenEvent(e) && !this.isPanning) return;

    if (this.isPanning) {
      const dx = e.clientX - (this.lastPointerPos?.x ?? e.clientX);
      const dy = e.clientY - (this.lastPointerPos?.y ?? e.clientY);
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this.rebuildCommittedCanvas();
      this.scheduleRender();
      return;
    }

    const pt = this.makePoint(e);

    if (this.isSelecting) {
      if (this.selectionPolygon.length > 0) {
        const last = this.selectionPolygon[this.selectionPolygon.length - 1];
        const dx = pt.x - last.x;
        const dy = pt.y - last.y;
        if (dx * dx + dy * dy < 4) return;
      }
      this.selectionPolygon.push(pt);
      this.scheduleRender();
      return;
    }

    if (!this.isDrawing) return;

    if (this.activeTool === 'eraser') {
      this.eraseAt(pt.x, pt.y);
      return;
    }

    if (this.rawPoints.length >= 5000) return;

    if (this.rawPoints.length > 0) {
      const last = this.rawPoints[this.rawPoints.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.5) return;

      if (this.rawPoints.length >= 2) {
        const prev = this.rawPoints[this.rawPoints.length - 2];
        const angle = this.computeAngleChange(prev, last, pt);
        if (angle > 0.35) {
          this.rawPoints.push(pt);
          this.scheduleRender();
          return;
        }
      }
    }

    this.rawPoints.push(pt);
    this.scheduleRender();
  }

  private onPointerUp(e: PointerEvent): void {
    if (this._destroyed) return;

    if (this.isPanning) {
      this.isPanning = false;
      this.lastPointerPos = null;
      return;
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      this.finishSelection();
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.activeTool === 'eraser') {
      this.rawPoints = [];
      this.scheduleRender();
      return;
    }

    if (this.rawPoints.length < 1) return;

    this.canvas.releasePointerCapture(e.pointerId);
    this.finalizeStroke();
  }

  private finalizeStroke(): void {
    const raw = this.rawPoints;
    this.rawPoints = [];

    const win = this.smoothingWindow();
    const commitPoints = buildStrokePath(raw, win);
    if (commitPoints.length < 1) return;

    const frozenPoints = Object.freeze(
      commitPoints.map(p => Object.freeze({ ...p }))
    ) as Point[];
    const stroke: Stroke = Object.freeze({
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tool: this.activeTool,
      color: this.currentColor,
      width: this.currentWidth,
      opacity: this.activeTool === 'marker'
        ? Math.min(this.currentOpacity, 0.5)
        : this.currentOpacity,
      points: frozenPoints,
      timestamp: Date.now(),
    }) as Stroke;

    this.undoStack.push(this.strokes);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];

    this.strokes = [...this.strokes, stroke];

    this.renderStrokeOnCtx(this.committedCtx, stroke);

    this.onStrokeAdded?.();
    this.onSaveNeeded?.();
    this.scheduleRender();
  }

  private eraseAt(x: number, y: number): void {
    const threshold = this.currentWidth * 10;
    const before = this.strokes.length;
    const kept = this.strokes.filter(s => {
      for (const p of s.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < threshold * threshold) return false;
      }
      return true;
    });
    if (kept.length !== before) {
      this.undoStack.push(this.strokes);
      this.strokes = kept;
      this.rebuildCommittedCanvas();
      this.onSaveNeeded?.();
      this.scheduleRender();
    }
  }

  private isPointInPolygon(px: number, py: number, polygon: Point[]): boolean {
    let inside = false;
    const n = polygon.length;
    if (n < 3) return false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if ((yi > py) !== (yj > py) &&
          px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private finishSelection(): void {
    if (this.selectionPolygon.length < 3) {
      this.selectionPolygon = [];
      this.selectedStrokeIds.clear();
      this.scheduleRender();
      return;
    }

    this.selectedStrokeIds.clear();
    for (const s of this.strokes) {
      let cx = 0, cy = 0, count = 0;
      for (const p of s.points) { cx += p.x; cy += p.y; count++; }
      if (count > 0) {
        cx /= count;
        cy /= count;
        if (this.isPointInPolygon(cx, cy, this.selectionPolygon)) {
          this.selectedStrokeIds.add(s.id);
        }
      }
    }
    this.scheduleRender();
  }

  deleteSelected(): void {
    if (this.selectedStrokeIds.size === 0) return;
    this.undoStack.push(this.strokes);
    this.strokes = this.strokes.filter(s => !this.selectedStrokeIds.has(s.id));
    this.selectedStrokeIds.clear();
    this.rebuildCommittedCanvas();
    this.onSaveNeeded?.();
    this.scheduleRender();
  }

  copySelected(): void {
    if (this.selectedStrokeIds.size === 0) return;
    this.undoStack.push(this.strokes);
    const newStrokes: Stroke[] = [];
    for (const s of this.strokes) {
      if (this.selectedStrokeIds.has(s.id)) {
        const copy: Stroke = JSON.parse(JSON.stringify(s));
        copy.id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        for (const p of copy.points) { p.x += 20; p.y += 20; }
        copy.timestamp = Date.now();
        newStrokes.push(copy);
      }
    }
    this.strokes = [...this.strokes, ...newStrokes];
    this.rebuildCommittedCanvas();
    this.onSaveNeeded?.();
    this.scheduleRender();
  }

  clearSelection(): void {
    this.selectionPolygon = [];
    this.selectedStrokeIds.clear();
    this.scheduleRender();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedStrokeIds.size > 0) {
        e.preventDefault();
        this.deleteSelected();
      }
    }
    if (e.key === 'Escape') {
      this.clearSelection();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    }
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.strokes);
    this.strokes = this.undoStack.pop()!;
    this.rebuildCommittedCanvas();
    this.onSaveNeeded?.();
    this.scheduleRender();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.strokes);
    this.strokes = this.redoStack.pop()!;
    this.rebuildCommittedCanvas();
    this.onSaveNeeded?.();
    this.scheduleRender();
  }

  setZoom(z: number): void {
    this.zoom = Math.max(0.1, Math.min(10, z));
    this.rebuildCommittedCanvas();
    this.scheduleRender();
  }

  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
    this.rebuildCommittedCanvas();
    this.scheduleRender();
  }

  setLayout(layout: LayoutType): void { this.background = layout; this.scheduleRender(); }
  setTool(tool: ToolType): void { this.activeTool = tool; }
  setColor(color: string): void { this.currentColor = color; }
  setWidth(width: number): void { this.currentWidth = Math.max(0.5, width); }
  setOpacity(opacity: number): void { this.currentOpacity = Math.max(0, Math.min(1, opacity)); }
  setSmoothing(amount: number): void { this.smoothing = Math.max(0, Math.min(100, amount)); }
  setPalmRejection(enabled: boolean): void { this.palmRejection = enabled; }
  setToolPressureEnabled(tool: string, enabled: boolean): void { this.toolPressureEnabled[tool] = enabled; }
  setPressureCurve(curve: PressureCurveConfig): void { this.pressureCurve = curve; }
  setDarkMode(enabled: boolean): void { this.darkMode = enabled; this.scheduleRender(); }

  private getBgColor(): string {
    return this.darkMode ? '#1e1e1e' : '#ffffff';
  }

  private getLineColor(): string {
    return this.darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  }

  private scheduleRender(): void {
    if (this.rafPending || this._destroyed) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.render();
    });
  }

  private render(): void {
    if (this._destroyed) return;
    this.ensureCanvasSize();

    const { w, h } = this.getCssSize();
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;

    const doFullRedraw = !this.isDrawing || this.needsFullRedraw;

    if (doFullRedraw) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.getBgColor();
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.zoom, this.zoom);

      this.renderBackground(ctx, w, h);
      this.renderAssets(ctx);

      ctx.drawImage(
        this.committedCanvas,
        0, 0,
        this.committedCanvas.width,
        this.committedCanvas.height,
        0, 0,
        w, h
      );

      this.renderSelectionOverlay(ctx);

      if (this.activeTool === 'selection' && this.isSelecting && this.selectionPolygon.length > 1) {
        this.renderLasso(ctx);
      }

      ctx.restore();
      this.needsFullRedraw = false;
      this.lastDrawnSegment = 0;
    }

    if (this.isDrawing && this.rawPoints.length >= 2) {
      const pts = this.rawPoints;
      const startIdx = Math.max(0, this.lastDrawnSegment);
      if (startIdx < pts.length - 1) {
        const tool = this.activeTool;
        const pressureEnabled = this.toolPressureEnabled[tool] ?? true;
        const opacity = tool === 'marker'
          ? Math.min(this.currentOpacity, 0.5)
          : this.currentOpacity;
        const isPencil = tool === 'pencil' && this.noisePattern !== null;

        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoom, this.zoom);
        ctx.globalAlpha = opacity;

        if (isPencil) {
          const pattern = ctx.createPattern(this.noisePattern!, 'repeat');
          ctx.strokeStyle = pattern || this.currentColor;
          ctx.globalCompositeOperation = 'multiply';
        } else {
          ctx.strokeStyle = this.currentColor;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = startIdx; i < pts.length - 1; i++) {
          const p1 = pts[i + 1];
          const w = getStrokeWidth(tool, this.currentWidth, p1.pressure, pressureEnabled);
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }

        if (isPencil) ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
      this.lastDrawnSegment = pts.length - 1;
    }
  }

  private rebuildCommittedCanvas(): void {
    this.needsFullRedraw = true;
    const { w, h } = this.getCssSize();
    if (w === 0 || h === 0) return;
    this.committedCanvas.width = Math.round(w * this.dpr);
    this.committedCanvas.height = Math.round(h * this.dpr);
    this.committedCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const stroke of this.strokes) {
      this.renderStrokeOnCtx(this.committedCtx, stroke);
    }
  }

  renderStrokeOnCtx(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    const pressureEnabled = this.toolPressureEnabled[stroke.tool] ?? true;
    const noise = stroke.tool === 'pencil' ? this.noisePattern : null;
    renderStroke(ctx, stroke, pressureEnabled, noise);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const lineColor = this.getLineColor();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.5;

    switch (this.background) {
      case 'blank': break;
      case 'ruled-narrow': this.renderRuled(ctx, w, h, 20); break;
      case 'ruled-wide': this.renderRuled(ctx, w, h, 36); break;
      case 'grid-small': this.renderGrid(ctx, w, h, 20); break;
      case 'grid-large': this.renderGrid(ctx, w, h, 40); break;
      case 'dot': this.renderDotGrid(ctx, w, h, 20); break;
      case 'isometric': this.renderIsometric(ctx, w, h, 30); break;
    }
  }

  private renderRuled(ctx: CanvasRenderingContext2D, w: number, h: number, spacing: number): void {
    ctx.beginPath();
    for (let y = spacing; y < h; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  private renderGrid(ctx: CanvasRenderingContext2D, w: number, h: number, size: number): void {
    ctx.beginPath();
    for (let x = size; x < w; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = size; y < h; y += size) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  private renderDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number, spacing: number): void {
    ctx.fillStyle = this.getLineColor();
    for (let x = spacing; x < w; x += spacing) {
      for (let y = spacing; y < h; y += spacing) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private renderIsometric(ctx: CanvasRenderingContext2D, w: number, h: number, size: number): void {
    ctx.beginPath();
    const step = size * Math.sqrt(3) / 2;
    for (let row = -1; row < h / step + 2; row++) {
      const y0 = row * step;
      ctx.moveTo(0, y0); ctx.lineTo(w, y0 + w * Math.tan(Math.PI / 6));
      ctx.moveTo(0, y0); ctx.lineTo(w, y0 - w * Math.tan(Math.PI / 6));
    }
    for (let x = -w; x < w * 2; x += size * 2) {
      ctx.moveTo(x, 0); ctx.lineTo(x + h * Math.tan(Math.PI / 6), h);
    }
    ctx.stroke();
  }

  private renderAssets(ctx: CanvasRenderingContext2D): void {
    for (const asset of this.assets) {
      const img = this.loadedImages.get(asset.path);
      if (img) { ctx.drawImage(img, asset.x, asset.y, asset.width, asset.height); }
    }
  }

  private renderSelectionOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.selectedStrokeIds.size === 0) return;
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
    for (const s of this.strokes) {
      if (!this.selectedStrokeIds.has(s.id)) continue;
      if (s.points.length === 0) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = 4 / this.zoom;
      ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderLasso(ctx: CanvasRenderingContext2D): void {
    if (this.selectionPolygon.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    ctx.beginPath();
    ctx.moveTo(this.selectionPolygon[0].x, this.selectionPolygon[0].y);
    for (let i = 1; i < this.selectionPolygon.length; i++) {
      ctx.lineTo(this.selectionPolygon[i].x, this.selectionPolygon[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private initNoisePattern(): void {
    const sz = 200;
    const nc = document.createElement('canvas');
    nc.width = sz;
    nc.height = sz;
    const nctx = nc.getContext('2d')!;
    const imgData = nctx.createImageData(sz, sz);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 80 + 40);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 60;
    }
    nctx.putImageData(imgData, 0, 0);
    this.noisePattern = nc;
  }

  loadAssets(assets: AssetRef[]): void {
    this.assets = assets;
    for (const a of assets) {
      if (a.type === 'image') {
        const img = new Image();
        img.src = a.path;
        img.onload = () => { this.loadedImages.set(a.path, img); this.scheduleRender(); };
        img.onerror = () => {};
      }
    }
  }

  toHandnotesFile(): HandnotesFile {
    return {
      version: 1,
      strokes: this.strokes,
      assets: this.assets,
      state: {
        zoom: this.zoom,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        background: this.background,
      },
    };
  }

  fromHandnotesFile(file: HandnotesFile): void {
    this.strokes = file.strokes || [];
    this.assets = file.assets || [];
    if (file.state) {
      this.zoom = file.state.zoom || 1;
      this.offsetX = file.state.offsetX || 0;
      this.offsetY = file.state.offsetY || 0;
      this.background = file.state.background || 'blank';
    }
    this.undoStack = [];
    this.redoStack = [];
    this.rebuildCommittedCanvas();
    this.loadAssets(this.assets);
    this.scheduleRender();
  }

  clearAll(): void {
    this.strokes = [];
    this.undoStack = [];
    this.redoStack = [];
    this.selectedStrokeIds.clear();
    this.selectionPolygon = [];
    this.rebuildCommittedCanvas();
    this.scheduleRender();
  }
}
