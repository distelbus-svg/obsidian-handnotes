export type ToolType =
  | 'fountain'
  | 'ballpoint'
  | 'pencil'
  | 'marker'
  | 'eraser'
  | 'selection'
  | 'pan';

export type LayoutType =
  | 'blank'
  | 'ruled-narrow'
  | 'ruled-wide'
  | 'grid-small'
  | 'grid-large'
  | 'dot'
  | 'isometric';

export interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  t: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  timestamp: number;
}

export interface AssetRef {
  id: string;
  type: 'image' | 'pdf';
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PressureCurveConfig {
  points: { x: number; y: number }[];
  clamp: boolean;
}

export interface CanvasState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  background: LayoutType;
}

export interface HandnotesFile {
  version: 1;
  strokes: Stroke[];
  assets: AssetRef[];
  state: CanvasState;
  pressureCurve?: PressureCurveConfig;
}

export interface BitmapSnapshot {
  imageData: ImageData;
  strokeCount: number;
}

export interface PluginSettings {
  pressureCurve: PressureCurveConfig;
  palmRejection: boolean;
  toolPressureEnabled: Record<string, boolean>;
  assetFolderName: string;
  autoSaveInterval: number;
  defaultTool: ToolType;
  defaultLayout: LayoutType;
  darkModeCanvasBg: boolean;
  strokeSmoothing: number;
  maxUndoHistory: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  pressureCurve: {
    points: [{ x: 0, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.7, y: 0.8 }, { x: 1, y: 1 }],
    clamp: true,
  },
  palmRejection: true,
  toolPressureEnabled: {
    fountain: true,
    ballpoint: true,
    pencil: true,
    marker: false,
    eraser: false,
    selection: false,
    pan: false,
  },
  assetFolderName: '_handnotes_assets',
  autoSaveInterval: 5,
  defaultTool: 'fountain',
  defaultLayout: 'blank',
  darkModeCanvasBg: false,
  strokeSmoothing: 50,
  maxUndoHistory: 50,
};
