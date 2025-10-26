
import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import {
  AngleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CircleIcon,
  CloseIcon,
  CropIcon,
  CurveIcon,
  EditIcon,
  EllipseIcon,
  EraserIcon,
  ExpandIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  LayersIcon,
  LineIcon,
  LockIcon,
  MarkerIcon,
  MergeDownIcon,
  OpacityIcon,
  PenIcon,
  PlusIcon,
  RectangleIcon,
  RedoIcon,
  ResetIcon,
  RotateCcwIcon,
  RotateCwIcon,
  TargetIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RectangleHorizontalIcon,
  PencilIcon,
} from './Icons';
import type { PoseImage, PerspectiveData, CharacterPoint } from '../types';
import { SetteiEditorModal } from './SetteiEditorModal';
import { ContiEditorModal } from './ContiEditorModal';

interface DrawingCanvasProps {
  title: string;
  description: string;
  onCanvasChange: (output: { 
    poses: PoseImage[], 
    perspective: PerspectiveData, 
    dimensions: { width: number, height: number },
    sketchBoundingBox: { x: number; y: number; width: number; height: number; } | null,
    lens: string;
    globalReferenceImage: { imageDataUrl: string } | null;
  }) => void;
  initialGlobalReferenceUrl?: string | null;
  editBaseImageUrl?: string | null;
}

interface SetteiImage {
  dataUrl: string;
  imageElement: HTMLImageElement;
  maskDataUrl?: string;
  maskImageElement?: HTMLImageElement;
}

interface Layer {
  id: number;
  name: string;
  isVisible: boolean;
  blendMode: GlobalCompositeOperation;
  opacity: number;
  type: 'sketch';
  points?: CharacterPoint[];
  setteiImages?: SetteiImage[];
}

interface GlobalReference {
  originalDataUrl: string;
  dataUrl: string;
  imageElement: HTMLImageElement;
  opacity: number;
  isVisible: boolean;
}

interface HistoryState {
  stack: ImageData[];
  index: number;
}

interface VanishingPoint {
    id: number;
    x: number;
    y: number;
}

type Point = { x: number; y: number };

const MAX_ZOOM = 8;
const MIN_ZOOM = 0.2;
const ZOOM_STEP = 1.2;
const MAX_HISTORY_STATES = 30; // Increased history states for more complex edits
const MIN_CANVAS_DIM = 200;

const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
    { value: 'source-over', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
    { value: 'color-dodge', label: 'Color Dodge' },
    { value: 'color-burn', label: 'Color Burn' },
    { value: 'hard-light', label: 'Hard Light' },
    { value: 'soft-light', label: 'Soft Light' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' },
    { value: 'hue', label: 'Hue' },
    { value: 'saturation', label: 'Saturation' },
    { value: 'color', label: 'Color' },
    { value: 'luminosity', label: 'Luminosity' },
];

type Tool = 'pen' | 'marker' | 'eraser' | 'line' | 'perspective' | 'curve' | 'ellipse' | 'point_placer' | 'point_deleter';

const generateRandomColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 30) + 70; // Saturation between 70-100%
  const l = Math.floor(Math.random() * 20) + 50; // Lightness between 50-70%
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const compressImageForStorage = (imageUrl: string, quality = 0.8, maxSize = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error("Could not get canvas context for compression.");
        resolve(imageUrl); // Fallback to original
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => {
        console.error("Failed to load image for compression, using original.", err);
        resolve(imageUrl); // Fallback to original
    };
    img.src = imageUrl;
  });
};

const compressCanvasForStorage = (sourceCanvas: HTMLCanvasElement, quality = 0.8): string => {
    if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        return '';
    }
    // Use PNG to preserve transparency of sketch layers. JPEG would create a black background.
    // The `quality` parameter is ignored for PNG but kept for signature consistency.
    return sourceCanvas.toDataURL('image/png');
};

const loadImageFromBase64 = (base64: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = base64;
    });
};

const getSketchesBoundingBox = (sketchLayers: Layer[], canvases: Record<number, HTMLCanvasElement | null>): { x: number, y: number, width: number, height: number } | null => {
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    let hasContent = false;

    for (const layer of sketchLayers) {
        // Layers passed here are already pre-filtered for visibility.
        const canvas = canvases[layer.id];
        if (!canvas) continue;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 0) {
                        hasContent = true;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
        } catch (e) {
            console.error("Error getting image data for bounding box:", e);
        }
    }
    
    if (!hasContent) {
        return null;
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
    };
};

const drawPath = (ctx: CanvasRenderingContext2D, points: Point[]) => {
  if (points.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length < 3) {
    // If 1 point, draw a dot. If 2, a straight line.
    const toPoint = points.length > 1 ? points[1] : points[0];
    ctx.lineTo(toPoint.x, toPoint.y);
  } else {
    // Draw a smooth curve through the points
    let i = 1;
    for (; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    // For the last 2 points, finish the curve
    ctx.quadraticCurveTo(
      points[i].x,
      points[i].y,
      points[i + 1].x,
      points[i + 1].y
    );
  }
  
  ctx.stroke();
};

interface SelectOption {
  value: string;
  label: string;
}

const lensOptions: SelectOption[] = [
  { value: 'none', label: '선택 안함' },
  { value: '14mm', label: '초광각 (14mm)' },
  { value: '24mm', label: '광각 (24mm)' },
  { value: '35mm', label: '표준 광각 (35mm)' },
  { value: '50mm', label: '표준 (50mm)' },
  { value: '85mm', label: '준망원 (85mm)' },
  { value: '135mm', label: '망원 (135mm)' },
  { value: '200mm', label: '초망원 (200mm)' },
];

const ColorPickerSelect: React.FC<{
  selectedColor: string;
  onSelectColor: (color: string) => void;
}> = ({ selectedColor, onSelectColor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-md flex items-center justify-center border border-neutral-500 bg-neutral-900/50"
        title="색상 선택"
      >
        <div
          className={`w-5 h-5 rounded ${selectedColor === '#FFFFFF' ? 'border border-neutral-400' : ''}`}
          style={{ backgroundColor: selectedColor }}
        />
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 z-20 bg-neutral-800 rounded-lg p-2 shadow-lg border border-neutral-600">
          <div className="flex justify-center">
            <div
              className={`w-14 h-14 rounded-md relative overflow-hidden border border-neutral-500`}
              title="사용자 지정 색상"
            >
                <div 
                  className="absolute inset-0 w-full h-full"
                  style={{
                      backgroundImage: `
                          conic-gradient(from 90deg at 50% 50%,
                              rgb(255, 0, 0),
                              rgb(255, 255, 0),
                              rgb(0, 255, 0),
                              rgb(0, 255, 255),
                              rgb(0, 0, 255),
                              rgb(255, 0, 255),
                              rgb(255, 0, 0)
                          )`
                  }}
                />
                <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => onSelectColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Reference Image Editor Modal (Simple Eraser) ---
interface ReferenceImageEditorModalProps {
  isOpen: boolean;
  dataUrl: string;
  onSave: (newDataUrl: string) => void;
  onClose: () => void;
}

const ReferenceImageEditorModal: React.FC<ReferenceImageEditorModalProps> = ({ isOpen, dataUrl, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [eraserSize, setEraserSize] = useState(40);
  const [_, forceUpdate] = useState({}); // To re-render on history change
  
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.splice(historyIndexRef.current + 1);
    historyRef.current.push(newImageData);
    if (historyRef.current.length > 50) { // Limit history size
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    forceUpdate({});
  }, []);

  const restoreHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyIndexRef.current < 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = historyRef.current[historyIndexRef.current];
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      historyIndexRef.current--;
      restoreHistory();
      forceUpdate({});
    }
  }, [canUndo, restoreHistory]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      historyIndexRef.current++;
      restoreHistory();
      forceUpdate({});
    }
  }, [canRedo, restoreHistory]);

  useEffect(() => {
    if (!isOpen) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill with white first to handle transparent source images
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        historyRef.current = [];
        historyIndexRef.current = -1;
        pushHistory();
      }
    };
    img.src = dataUrl;
  }, [isOpen, dataUrl, pushHistory]);

  const getCoords = (e: React.MouseEvent): { x: number, y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
          x: (e.clientX - rect.left) / (rect.width / canvas.width),
          y: (e.clientY - rect.top) / (rect.height / canvas.height),
      };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCoords(e);
    if (!coords) return;
    isDrawingRef.current = true;
    lastPointRef.current = coords;
    pushHistory();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    const coords = getCoords(e);
    const lastPoint = lastPointRef.current;
    if (!coords || !lastPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    ctx.save();
    // Erase to white instead of transparency.
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = eraserSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.restore();
    
    lastPointRef.current = coords;
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleUndo, handleRedo]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
      aria-modal="true" 
      role="dialog"
    >
      <div 
        className="bg-[#363636] rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-neutral-700/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-700/80 flex-shrink-0">
          <h2 className="text-xl font-semibold text-neutral-100 flex items-center gap-3">
            <EditIcon />
            참조 이미지 편집기
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:bg-neutral-600 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-grow p-4 overflow-hidden relative" style={{
            backgroundColor: '#4f4f4f',
            backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }}>
            <div className="w-full h-full flex items-center justify-center">
                <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>
        </div>
        <div className="flex justify-between items-center gap-4 p-4 bg-[#2f2f2f] border-t border-neutral-700/80 rounded-b-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <EraserIcon />
              <input 
                type="range" 
                min="1" 
                max="200" 
                value={eraserSize} 
                onChange={e => setEraserSize(Number(e.target.value))}
                className="w-48 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="w-8 text-center font-mono text-sm">{eraserSize}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleUndo} disabled={!canUndo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50"><UndoIcon /></button>
              <button onClick={handleRedo} disabled={!canRedo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50"><RedoIcon /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-neutral-600 text-neutral-100 font-medium rounded-md hover:bg-neutral-500 transition-colors">취소</button>
            <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const drawVariableWidthPath = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    baseSize: number,
    sensitivity: number
) => {
    if (sensitivity === 0 || points.length < 2) {
        drawPath(ctx, points);
        return;
    }

    // --- Increased smoothing factors ---
    const widthSmoothingFactor = 0.8; // More smoothing
    const velocitySensitivity = 25; // More responsive

    let lastWidth = baseSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (points.length < 3) {
        ctx.lineWidth = baseSize;
        drawPath(ctx, points); // Use original for short lines
        return;
    }

    let p1 = points[0];
    let p2 = points[1];
    let midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(midPoint.x, midPoint.y);

    for (let i = 1; i < points.length - 1; i++) {
        p1 = points[i];
        p2 = points[i + 1];
        const nextMidPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        // Calculate velocity at p1
        const distance = Math.hypot(p1.x - points[i-1].x, p1.y - points[i-1].y);
        const velocity = Math.min(distance / velocitySensitivity, 1.0);
        
        const targetWidth = baseSize - (baseSize * 0.9) * velocity * sensitivity;
        const currentWidth = lastWidth * widthSmoothingFactor + targetWidth * (1 - widthSmoothingFactor);
        
        // Stroke the previous segment with the calculated width
        ctx.lineWidth = Math.max(baseSize * 0.1, currentWidth);
        ctx.quadraticCurveTo(p1.x, p1.y, nextMidPoint.x, nextMidPoint.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(nextMidPoint.x, nextMidPoint.y);
        
        lastWidth = currentWidth;
        midPoint = nextMidPoint;
    }

    // Draw last line segment
    ctx.lineWidth = lastWidth;
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
};

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ title, description, onCanvasChange, initialGlobalReferenceUrl, editBaseImageUrl }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewLineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const perspectiveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const setteiFileInputRef = useRef<HTMLInputElement>(null);
  const globalRefFileInputRef = useRef<HTMLInputElement>(null);

  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const pointsRef = useRef<Point[]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [globalReference, setGlobalReference] = useState<GlobalReference | null>(null);
  const [editBase, setEditBase] = useState<GlobalReference | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<number | null>(null);
  const [layerCounter, setLayerCounter] = useState(1);
  
  const [tool, setTool] = useState<Tool>('pen');
  const [lens, setLens] = useState<string>('50mm');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isScrubbyZooming, setIsScrubbyZooming] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastTouchesRef = useRef<TouchList | null>(null);

  const [penColor, setPenColor] = useState<string>('#000000');
  const [penSize, setPenSize] = useState<number>(3);
  const [penSensitivity, setPenSensitivity] = useState<number>(0.4);
  const [eraserSize, setEraserSize] = useState<number>(25);
  const [markerColor, setMarkerColor] = useState<string>('#404040');
  const [markerSize, setMarkerSize] = useState<number>(20);
  const [markerOpacity, setMarkerOpacity] = useState<number>(0.2);
  const [markerRotation, setMarkerRotation] = useState<number>(0);
  const [markerShape, setMarkerShape] = useState<'rectangle' | 'circle'>('rectangle');
  
  const [draggingPoint, setDraggingPoint] = useState<{ layerId: number; pointId: number } | null>(null);
  const [resizingPoint, setResizingPoint] = useState<{
    layerId: number;
    pointId: number;
    startMouseX: number;
    startRadiusPixels: number;
  } | null>(null);
  const [targetLayerForSettei, setTargetLayerForSettei] = useState<number | null>(null);

  const [history, setHistory] = useState<Record<number, HistoryState>>({});
  const [lineStartPoint, setLineStartPoint] = useState<{ x: number; y: number; label?: string; } | null>(null);
  const [ellipseStartPoint, setEllipseStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [curvePoints, setCurvePoints] = useState<{ x: number; y: number }[]>([]);
  
  // Guide states
  const [vanishingPoints, setVanishingPoints] = useState<VanishingPoint[]>([]);
  const [activeVPId, setActiveVPId] = useState<number | null>(null);
  const [draggingVPId, setDraggingVPId] = useState<number | null>(null);
  
  // Canvas Dimensions State
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1000, height: 619 });
  const resizeDataRef = useRef<{
    layerData: Map<number, ImageData | null>;
    globalRef: GlobalReference | null;
    editBaseRef: GlobalReference | null;
  } | null>(null);
  const prevDimensionsRef = useRef(canvasDimensions);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartDataRef = useRef<{ startX: number; startY: number; startW: number; startH: number; direction: 'r' | 'b' | 'br'; } | null>(null);

  // Editor Modals State
  const [editingReference, setEditingReference] = useState<{ type: 'editBase'; dataUrl: string; } | null>(null);
  const [isContiEditorOpen, setIsContiEditorOpen] = useState(false);
  const [editingSettei, setEditingSettei] = useState<{ layerId: number; imageIndex: number; imageUrl: string; maskUrl?: string; } | null>(null);

  // State persistence refs
  const loadedStateRef = useRef<{layers: any, sketches: any, globalRef: any} | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const onCanvasChangeTimeoutRef = useRef<number | null>(null);
  
  const getActiveContext = useCallback((): CanvasRenderingContext2D | null => {
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer) return null;
    const canvas = canvasRefs.current[activeLayerId!];
    return canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
  }, [activeLayerId, layers]);
  
  const redrawPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        if (previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            previewCtx.fillStyle = 'white';
            previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const drawImageFit = (img: HTMLImageElement) => {
                const canvas = previewCtx.canvas;
                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio);
                const centerShift_x = (canvas.width - img.width * ratio) / 2;
                const centerShift_y = (canvas.height - img.height * ratio) / 2;  
                previewCtx.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
            };

            // 0. Draw Global Reference Image (Conti)
            if (globalReference && globalReference.isVisible) {
                previewCtx.globalAlpha = globalReference.opacity;
                previewCtx.globalCompositeOperation = 'source-over';
                drawImageFit(globalReference.imageElement);
            }
            
            // 1. Draw Edit Base Image
            if (editBase && editBase.isVisible) {
                previewCtx.globalAlpha = editBase.opacity;
                previewCtx.globalCompositeOperation = 'source-over';
                drawImageFit(editBase.imageElement);
            }

            // 2. Draw Sketch Layers
            [...layers].forEach(layer => {
                if (!layer.isVisible) return;
                previewCtx.globalAlpha = layer.opacity;
                previewCtx.globalCompositeOperation = layer.blendMode;
                const layerCanvas = canvasRefs.current[layer.id];
                if (layerCanvas) {
                    previewCtx.drawImage(layerCanvas, 0, 0);
                }
            });

            previewCtx.globalAlpha = 1;
            previewCtx.globalCompositeOperation = 'source-over';
        }
    }
  }, [layers, globalReference, editBase]);


  useEffect(() => {
    redrawPreview();
  }, [layers, globalReference, editBase, redrawPreview]);

  const saveState = useCallback(() => {
    if (!activeLayerId) return;
    const sketchCtx = getActiveContext();
    const sketchCanvas = canvasRefs.current[activeLayerId];
    if (!sketchCtx || !sketchCanvas) return;

    const sketchImageData = sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height);

    setHistory(prev => {
        const layerHistory = prev[activeLayerId] ?? { stack: [], index: -1 };
        const newStack = layerHistory.stack.slice(0, layerHistory.index + 1);
        newStack.push(sketchImageData);

        // Truncate the stack if it's too long
        while (newStack.length > MAX_HISTORY_STATES) {
          newStack.shift();
        }

        return {
            ...prev,
            [activeLayerId]: {
                stack: newStack,
                index: newStack.length - 1,
            },
        };
    });
  }, [activeLayerId, getActiveContext]);

  const debouncedOnCanvasChange = useCallback(() => {
    if (onCanvasChangeTimeoutRef.current) {
      clearTimeout(onCanvasChangeTimeoutRef.current);
    }
    onCanvasChangeTimeoutRef.current = window.setTimeout(() => {
        const outputs: PoseImage[] = [];
        const visibleLayers = layers.filter(l => l.isVisible);
        
        visibleLayers.forEach(layer => {
            const getSketchDataUrl = (layerId: number): string => {
                const layerCanvas = canvasRefs.current[layerId];
                if (!layerCanvas) return '';
                const ctx = layerCanvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return '';
                const buffer = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height).data;
                return buffer.some(channel => channel !== 0) ? layerCanvas.toDataURL('image/png') : '';
            };

            const sketchDataUrl = getSketchDataUrl(layer.id);
            const hasContent = sketchDataUrl || (layer.points && layer.points.length > 0) || (layer.setteiImages && layer.setteiImages.length > 0);

            if (hasContent) {
                outputs.push({
                    name: layer.name,
                    imageDataUrl: sketchDataUrl,
                    setteiImages: layer.setteiImages?.map(img => ({
                        imageUrl: img.dataUrl,
                        maskUrl: img.maskDataUrl,
                    })) || [],
                    points: layer.points,
                });
            }
        });
        
        const normalizedVPs = vanishingPoints.map(vp => ({
            id: vp.id,
            x: vp.x / canvasDimensions.width,
            y: vp.y / canvasDimensions.height,
        }));
        
        const subjectLayersForBBox = layers.filter(l => l.isVisible);
        const sketchBoundingBox = getSketchesBoundingBox(subjectLayersForBBox, canvasRefs.current);

        onCanvasChange({
          poses: outputs,
          perspective: { vanishingPoints: normalizedVPs },
          dimensions: canvasDimensions,
          sketchBoundingBox,
          lens,
          globalReferenceImage: (globalReference && globalReference.isVisible) 
            ? { imageDataUrl: globalReference.dataUrl } 
            : null,
        });
    }, 300);
  }, [layers, onCanvasChange, vanishingPoints, canvasDimensions, lens, globalReference]);

  useEffect(() => {
    debouncedOnCanvasChange();
  }, [lens, debouncedOnCanvasChange]);

  const handleUndo = useCallback(() => {
    if (!activeLayerId) return;
    const layerHistory = history[activeLayerId];
    if (layerHistory && layerHistory.index > 0) {
        const newIndex = layerHistory.index - 1;
        const stateToRestore = layerHistory.stack[newIndex];
        
        const sketchCtx = getActiveContext();
        if (sketchCtx) {
            sketchCtx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);
            sketchCtx.putImageData(stateToRestore, 0, 0);
        }

        setHistory(prev => ({
            ...prev,
            [activeLayerId]: { ...layerHistory, index: newIndex }
        }));
        redrawPreview();
        debouncedOnCanvasChange();
    }
  }, [activeLayerId, history, getActiveContext, canvasDimensions, redrawPreview, debouncedOnCanvasChange]);
  
  const handleRedo = useCallback(() => {
    if (!activeLayerId) return;
    const layerHistory = history[activeLayerId];
    if (layerHistory && layerHistory.index < layerHistory.stack.length - 1) {
        const newIndex = layerHistory.index + 1;
        const stateToRestore = layerHistory.stack[newIndex];
        
        const sketchCtx = getActiveContext();
        if (sketchCtx) {
            sketchCtx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);
            sketchCtx.putImageData(stateToRestore, 0, 0);
        }
        
        setHistory(prev => ({
            ...prev,
            [activeLayerId]: { ...layerHistory, index: newIndex }
        }));
        redrawPreview();
        debouncedOnCanvasChange();
    }
  }, [activeLayerId, history, getActiveContext, canvasDimensions, redrawPreview, debouncedOnCanvasChange]);
  
  const addSketchLayer = () => {
    const newId = Date.now();
    const newLayer: Layer = { 
        id: newId, 
        name: `레이어 ${layerCounter}`, 
        isVisible: true, 
        blendMode: 'source-over', 
        opacity: 1, 
        type: 'sketch',
        points: [],
        setteiImages: [],
    };
    
    setLayers(prevLayers => {
        const activeIndex = prevLayers.findIndex(l => l.id === activeLayerId);
        const newLayers = [...prevLayers];
        newLayers.splice(activeIndex + 1, 0, newLayer);
        return newLayers;
    });

    setLayerCounter(prev => prev + 1);
    setActiveLayerId(newId);
    
    setTimeout(() => {
        const newCanvas = canvasRefs.current[newId];
        const newCtx = newCanvas?.getContext('2d', { willReadFrequently: true });
        if (newCanvas && newCtx) {
            newCtx.clearRect(0, 0, newCanvas.width, newCanvas.height);
            const imageData = newCtx.getImageData(0, 0, newCanvas.width, newCanvas.height);
            setHistory(prev => ({
                ...prev,
                [newId]: { stack: [imageData], index: 0 }
            }));
        }
    }, 0);
  };

  const handleSetteiUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!targetLayerForSettei) return;
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const layerId = targetLayerForSettei;

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            const compressedDataUrl = await compressImageForStorage(dataUrl);
            const imageElement = await loadImageFromBase64(compressedDataUrl);

            setLayers(prevLayers => prevLayers.map(l => {
                if (l.id === layerId) {
                    return {
                        ...l,
                        setteiImages: [...(l.setteiImages || []), { dataUrl: compressedDataUrl, imageElement }]
                    };
                }
                return l;
            }));
        };
        reader.readAsDataURL(file);
      }
      
      setTargetLayerForSettei(null);
      event.target.value = '';
  };
    
  const triggerCharacterSetteiUpload = (layerId: number) => {
      setTargetLayerForSettei(layerId);
      setteiFileInputRef.current?.click();
  };

  const removeSetteiImage = (layerId: number, dataUrlToRemove: string) => {
      setLayers(prev => prev.map(l => {
          if (l.id === layerId) {
              return {
                  ...l,
                  setteiImages: l.setteiImages?.filter(img => img.dataUrl !== dataUrlToRemove)
              };
          }
          return l;
      }));
  };
  
  const handleSetteiMaskSave = async (maskDataUrl: string) => {
    if (!editingSettei) return;
    const { layerId, imageIndex } = editingSettei;
    const maskImageElement = await loadImageFromBase64(maskDataUrl);

    setLayers(prev => prev.map(l => {
        if (l.id === layerId) {
            const newSetteiImages = [...(l.setteiImages || [])];
            if (newSetteiImages[imageIndex]) {
                 newSetteiImages[imageIndex] = { ...newSetteiImages[imageIndex], maskDataUrl, maskImageElement };
            }
            return { ...l, setteiImages: newSetteiImages };
        }
        return l;
    }));
    setEditingSettei(null);
  };

  const handleGlobalRefUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          const imageElement = await loadImageFromBase64(dataUrl);
          setGlobalReference({
              originalDataUrl: dataUrl,
              dataUrl: dataUrl,
              imageElement,
              opacity: 0.5,
              isVisible: true,
          });
          setIsContiEditorOpen(true);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
  };

  const toggleGlobalRefVisibility = () => {
    setGlobalReference(prev => prev ? { ...prev, isVisible: !prev.isVisible } : null);
  };
  
  const handleGlobalRefOpacityChange = (newOpacity: number) => {
    setGlobalReference(prev => prev ? { ...prev, opacity: newOpacity } : null);
  };
  
  const toggleEditBaseVisibility = () => {
    setEditBase(prev => prev ? { ...prev, isVisible: !prev.isVisible } : null);
  };
  
  const handleEditBaseOpacityChange = (newOpacity: number) => {
    setEditBase(prev => prev ? { ...prev, opacity: newOpacity } : null);
  };

  const handleSaveReferenceEdit = async (newDataUrl: string) => {
    if (!editingReference) return;
    
    const compressedDataUrl = await compressImageForStorage(newDataUrl);
    const newImageElement = await loadImageFromBase64(compressedDataUrl);

    if (editingReference.type === 'editBase') {
        setEditBase(prev => prev ? { ...prev, dataUrl: compressedDataUrl, imageElement: newImageElement } : null);
    }
    
    setEditingReference(null);
  };

  const handleSaveContiEdit = async (newDataUrl: string) => {
    const compressedDataUrl = await compressImageForStorage(newDataUrl);
    const imageElement = await loadImageFromBase64(compressedDataUrl);
    setGlobalReference(prev => prev ? { ...prev, dataUrl: compressedDataUrl, imageElement } : null);
    setIsContiEditorOpen(false);
  };

  // Load state from localStorage on mount
  useEffect(() => {
    const initializeCanvas = async () => {
        let savedState: any = null;
        try {
            const savedStateJSON = localStorage.getItem('character-poser-canvas');
            if (savedStateJSON) {
                savedState = JSON.parse(savedStateJSON);
            }
        } catch (e) {
            console.error("캔버스 상태 로딩 실패", e);
            localStorage.removeItem('character-poser-canvas');
        }

        let initialGlobalRef = null;
        if (initialGlobalReferenceUrl) {
             const compressedInitialUrl = await compressImageForStorage(initialGlobalReferenceUrl);
             initialGlobalRef = { originalDataUrl: compressedInitialUrl, dataUrl: compressedInitialUrl, opacity: 0.5, isVisible: true };
        }

        if (savedState) {
            const loadedDimensions = savedState.canvasDimensions || { width: 1000, height: 619 };
            setCanvasDimensions(loadedDimensions);
            setVanishingPoints(savedState.vanishingPoints || []);
            setLayerCounter(savedState.layerCounter || 1);
            
            loadedStateRef.current = {
                layers: savedState.layers || [],
                sketches: savedState.layerSketches || {},
                globalRef: initialGlobalRef || savedState.globalReference || null,
            };
        } else {
            const previewCanvas = previewCanvasRef.current;
            if (previewCanvas) {
                const previewCtx = previewCanvas.getContext('2d');
                if (previewCtx) {
                    previewCtx.fillStyle = 'white';
                    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                }
            }

            if (initialGlobalRef) {
                 loadedStateRef.current = {
                    layers: [],
                    sketches: {},
                    globalRef: initialGlobalRef,
                };
            }

            const initialId = Date.now();
            const firstLayer: Layer = {
                id: initialId,
                name: `레이어 1`,
                isVisible: true,
                blendMode: 'source-over',
                opacity: 1,
                type: 'sketch',
                points: [],
                setteiImages: [],
            };

            setLayers([firstLayer]);
            setActiveLayerId(initialId);
            setLayerCounter(2);

            setTimeout(() => {
                const canvas = canvasRefs.current[initialId];
                const ctx = canvas?.getContext('2d', { willReadFrequently: true });
                if (canvas && ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    setHistory({ [initialId]: { stack: [imageData], index: 0 } });
                }
            }, 0);
        }
    };
    
    initializeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGlobalReferenceUrl]);

  // Effect to handle entering/exiting edit mode
  useEffect(() => {
    const loadEditBase = async () => {
        if (editBaseImageUrl) {
            // Entering a new editing session.
            const compressedUrl = await compressImageForStorage(editBaseImageUrl);
            const imageElement = await loadImageFromBase64(compressedUrl);
            setEditBase({
                originalDataUrl: compressedUrl,
                dataUrl: compressedUrl,
                imageElement,
                opacity: 0.7,
                isVisible: true,
            });
            
            // Clear all sketch layers for the new edit session.
            setLayers(prev => {
                const newHistory: Record<number, HistoryState> = {};
                prev.forEach(l => {
                    const canvas = canvasRefs.current[l.id];
                    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
                    if (ctx && canvas) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        newHistory[l.id] = { stack: [imageData], index: 0 };
                    }
                });
                setHistory(newHistory);
                return prev;
            });
            
        } else {
            // Exiting edit mode
            setEditBase(null);
        }
    };
    loadEditBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editBaseImageUrl]);

  // Effect to draw loaded data onto canvases once they are rendered
  useLayoutEffect(() => {
    if (!loadedStateRef.current) return;
    
    const { layers: layersToLoad, sketches, globalRef } = loadedStateRef.current;

    const restoreCanvases = async () => {
        const newHistory: Record<number, HistoryState> = {};

        if (globalRef && globalRef.dataUrl) {
            try {
                const imageElement = await loadImageFromBase64(globalRef.dataUrl);
                setGlobalReference({ ...globalRef, imageElement });
            } catch(e) {
                 console.error("글로벌 참조 이미지 로딩 실패:", e);
            }
        }
        
        const loadedLayers = await Promise.all(layersToLoad.map(async (l: any) => {
            if (l.characterSettings && Array.isArray(l.characterSettings) && l.characterSettings.length > 0) {
                // Migrate from old `characterSettings` format to new `setteiImages` format
                const mainSetting = l.characterSettings[0];
                l.name = mainSetting.name || l.name;
                l.setteiImages = await Promise.all(mainSetting.images.map(async (img: any) => ({
                    dataUrl: img.dataUrl,
                    imageElement: await loadImageFromBase64(img.dataUrl),
                    maskDataUrl: img.maskDataUrl,
                    maskImageElement: img.maskDataUrl ? await loadImageFromBase64(img.maskDataUrl) : undefined,
                })));
                delete l.characterSettings;
            } else if (!l.setteiImages) {
                l.setteiImages = [];
            } else {
                 l.setteiImages = await Promise.all(
                    l.setteiImages.map(async (img: any) => ({
                        dataUrl: img.dataUrl,
                        imageElement: await loadImageFromBase64(img.dataUrl),
                        maskDataUrl: img.maskDataUrl,
                        maskImageElement: img.maskDataUrl ? await loadImageFromBase64(img.maskDataUrl) : undefined,
                    }))
                );
            }

            if (l.referenceImage) { delete l.referenceImage; }
            if (!l.points) { l.points = []; }
            l.points = l.points.map((p: any) => ({
                ...p,
                radius: p.radius === undefined ? 15 : p.radius,
                color: p.color || generateRandomColor(),
            }));
            l.type = 'sketch';
            return l;
        }));
        setLayers(loadedLayers);

        const restorationPromises = loadedLayers.map(async (layer: Layer) => {
            if (layer.type === 'sketch') {
                const layerId = layer.id;
                const sketchCanvas = canvasRefs.current[layerId];
                if (!sketchCanvas) return;
                const sketchCtx = sketchCanvas.getContext('2d', { willReadFrequently: true });

                if (sketchCtx) {
                    if (sketches[layerId]) {
                        try {
                            const img = await loadImageFromBase64(sketches[layerId]);
                            sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
                            sketchCtx.drawImage(img, 0, 0);
                        } catch (err) {
                            console.error(`레이어 ${layerId}의 스케치 로딩 실패:`, err);
                        }
                    }
                    try {
                        const sketchImageData = sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height);
                        newHistory[layerId] = {
                            stack: [sketchImageData],
                            index: 0
                        };
                    } catch (e) {
                        console.error("Failed to getImageData during restore:", e);
                    }
                }
            }
        });
        
        await Promise.all(restorationPromises);
        
        setHistory(newHistory);
        
        if (loadedLayers.length > 0) {
            const lastLayer = loadedLayers[loadedLayers.length - 1];
            setActiveLayerId(lastLayer?.id || null);
        }
        
        loadedStateRef.current = null;
        redrawPreview();
        debouncedOnCanvasChange();
    };

    restoreCanvases();
  }, [redrawPreview, debouncedOnCanvasChange]);

  // Save state to localStorage with debounce
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (layers.length === 0 && !globalReference) return;

    saveTimeoutRef.current = window.setTimeout(async () => {
        try {
            const layerSketches: Record<number, string> = {};
            const layersToSave = layers.map(l => {
                const { setteiImages, ...restOfLayer } = l;
                const serializableLayer: any = { ...restOfLayer };
                
                if (setteiImages) {
                    serializableLayer.setteiImages = setteiImages.map(img => {
                        const { imageElement, maskImageElement, ...rest } = img;
                        return rest;
                    });
                }
                const canvas = canvasRefs.current[l.id];
                if (canvas) {
                    layerSketches[l.id] = compressCanvasForStorage(canvas);
                }
                return serializableLayer;
            });
            
            let serializableGlobalRef = null;
            if (globalReference) {
                const { imageElement, ...rest } = globalReference;
                serializableGlobalRef = rest;
            }

            const stateToSave = {
                layers: layersToSave,
                layerSketches,
                globalReference: serializableGlobalRef,
                vanishingPoints,
                canvasDimensions,
                layerCounter,
            };
            
            localStorage.setItem('character-poser-canvas', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("캔버스 상태 저장 실패", e);
        }
    }, 1500);

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [layers, vanishingPoints, canvasDimensions, layerCounter, globalReference]);

  useEffect(() => {
    const ctx = getActiveContext();
    if (ctx) {
      if (tool === 'pen' || tool === 'line' || tool === 'curve' || tool === 'ellipse') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = eraserSize;
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else {
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }, [tool, penColor, penSize, eraserSize, getActiveContext]);

  useEffect(() => {
    // Reset special tool states when tool or layer changes
    setIsDrawing(false);
    setCurvePoints([]);
    setLineStartPoint(null);
    setEllipseStartPoint(null);
    
    const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
    if (previewLineCtx && previewLineCanvasRef.current) {
        previewLineCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
    }
  }, [tool, activeLayerId]);

  // Draw Perspective Guides
  useEffect(() => {
    const perspectiveCanvas = perspectiveCanvasRef.current;
    if (!perspectiveCanvas) return;
    const ctx = perspectiveCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, perspectiveCanvas.width, perspectiveCanvas.height);

    vanishingPoints.forEach(vp => {
        ctx.strokeStyle = '#60a5fa'; // Lighter blue (Tailwind blue-400)
        ctx.lineWidth = 0.75;
        ctx.globalAlpha = 0.5;
        
        const corners = [ {x: 0, y: 0}, {x: canvasDimensions.width, y: 0}, {x: canvasDimensions.width, y: canvasDimensions.height}, {x: 0, y: canvasDimensions.height}, ];
        corners.forEach(corner => {
            ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(corner.x, corner.y); ctx.stroke();
        });

        for (let i = 1; i < 4; i++) {
            const p = i / 4;
            ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(p * canvasDimensions.width, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(p * canvasDimensions.width, canvasDimensions.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(0, p * canvasDimensions.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(canvasDimensions.width, p * canvasDimensions.height); ctx.stroke();
        }
    });

    if (vanishingPoints.length > 0) {
        ctx.strokeStyle = '#ef4444'; // Tailwind red-500
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([6, 4]);

        if (vanishingPoints.length === 1) {
            const vp = vanishingPoints[0];
            ctx.beginPath(); ctx.moveTo(0, vp.y); ctx.lineTo(canvasDimensions.width, vp.y); ctx.stroke();
        } else if (vanishingPoints.length >= 2) {
            const [first, ...rest] = vanishingPoints;
            ctx.beginPath(); ctx.moveTo(first.x, first.y);
            rest.forEach(vp => ctx.lineTo(vp.x, vp.y));
            if (vanishingPoints.length === 3) { ctx.closePath(); }
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    vanishingPoints.forEach(vp => {
        ctx.globalAlpha = 1.0;
        const isActive = vp.id === activeVPId;
        ctx.fillStyle = isActive ? 'rgba(0, 122, 255, 1)' : 'rgba(239, 68, 68, 1)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(vp.x, vp.y, 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
  }, [vanishingPoints, activeVPId, canvasDimensions]);
  
  const backupCanvasStateForResize = useCallback(() => {
    const dataToRestore = new Map<number, ImageData | null>();
    layers.forEach(layer => {
        let sketchData: ImageData | null = null;
        const sketchCanvas = canvasRefs.current[layer.id];
        if (sketchCanvas) {
            const sketchCtx = sketchCanvas.getContext('2d', { willReadFrequently: true });
            if (sketchCtx) {
                sketchData = sketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height);
            }
        }
        dataToRestore.set(layer.id, sketchData);
    });
    resizeDataRef.current = {
        layerData: dataToRestore,
        globalRef: globalReference,
        editBaseRef: editBase,
    };
    prevDimensionsRef.current = canvasDimensions;
  }, [layers, canvasDimensions, globalReference, editBase]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, direction: 'r' | 'b' | 'br') => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartDataRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: canvasDimensions.width,
        startH: canvasDimensions.height,
        direction,
    };
    backupCanvasStateForResize();
  }, [canvasDimensions, backupCanvasStateForResize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!resizeStartDataRef.current) return;
        const { startX, startY, startW, startH, direction } = resizeStartDataRef.current;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth: number, newHeight: number;
        
        if (direction === 'r') {
            newWidth = Math.max(MIN_CANVAS_DIM, startW + dx);
            newHeight = startH;
        } else if (direction === 'b') {
            newWidth = startW;
            newHeight = Math.max(MIN_CANVAS_DIM, startH + dy);
        } else {
            newWidth = Math.max(MIN_CANVAS_DIM, startW + dx);
            newHeight = Math.max(MIN_CANVAS_DIM, startH + dy);
        }
        
        setCanvasDimensions({
            width: Math.round(newWidth),
            height: Math.round(newHeight),
        });
    };

    const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartDataRef.current = null;

        const oldDims = prevDimensionsRef.current;
        // Use a function call to get the latest state value, avoiding stale closures.
        setCanvasDimensions(currentDims => {
            const newDims = currentDims;
            if (oldDims.width !== newDims.width || oldDims.height !== newDims.height) {
                const scaleX = newDims.width / oldDims.width;
                const scaleY = newDims.height / oldDims.height;
    
                setVanishingPoints(prevVPs => prevVPs.map(vp => ({
                    ...vp,
                    x: vp.x * scaleX,
                    y: vp.y * scaleY,
                })));
            }
            return newDims;
        });

        // After all state updates related to resize are queued, clear the backup ref.
        resizeDataRef.current = null;
    };

    if (isResizing) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
    }

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);


  useLayoutEffect(() => {
    if (!resizeDataRef.current) {
        return;
    }

    const { layerData, globalRef, editBaseRef } = resizeDataRef.current;
    const oldDimensions = prevDimensionsRef.current;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const newHistory: Record<number, HistoryState> = {};

    layerData.forEach((sketch, layerId) => {
        const sketchCanvas = canvasRefs.current[layerId];
        const sketchCtx = sketchCanvas?.getContext('2d');
        if (sketchCanvas && sketchCtx && sketch) {
            tempCanvas.width = sketch.width;
            tempCanvas.height = sketch.height;
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.putImageData(sketch, 0, 0);

            sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
            sketchCtx.imageSmoothingEnabled = true;
            sketchCtx.drawImage(tempCanvas, 0, 0, oldDimensions.width, oldDimensions.height, 0, 0, canvasDimensions.width, canvasDimensions.height);
        }
        
        const newSketchCtx = sketchCanvas?.getContext('2d', { willReadFrequently: true });
        if (sketchCanvas && newSketchCtx) {
            try {
              const newImageData = newSketchCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height);
              newHistory[layerId] = { stack: [newImageData], index: 0 };
            } catch (e) {
              console.error("Error getting image data after resize", e)
            }
        }
    });
    
    setHistory(newHistory);
    
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        if (previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            previewCtx.fillStyle = 'white';
            previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const drawImageFit = (img: HTMLImageElement) => {
                const canvas = previewCtx.canvas;
                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio);
                const centerShift_x = (canvas.width - img.width * ratio) / 2;
                const centerShift_y = (canvas.height - img.height * ratio) / 2;  
                previewCtx.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
            };

            if (globalRef && globalRef.isVisible) {
                previewCtx.globalAlpha = globalRef.opacity;
                previewCtx.globalCompositeOperation = 'source-over';
                drawImageFit(globalRef.imageElement);
            }
            
            if (editBaseRef && editBaseRef.isVisible) {
                previewCtx.globalAlpha = editBaseRef.opacity;
                previewCtx.globalCompositeOperation = 'source-over';
                drawImageFit(editBaseRef.imageElement);
            }

            layers.forEach(layer => {
                if (!layer.isVisible) return;
                previewCtx.globalAlpha = layer.opacity;
                previewCtx.globalCompositeOperation = layer.blendMode;
                const layerCanvas = canvasRefs.current[layer.id];
                if (layerCanvas) {
                    previewCtx.drawImage(layerCanvas, 0, 0);
                }
            });

            previewCtx.globalAlpha = 1;
            previewCtx.globalCompositeOperation = 'source-over';
        }
    }
    
    debouncedOnCanvasChange();
  }, [canvasDimensions, layers, debouncedOnCanvasChange]);


  const getCoords = useCallback((event: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in event.nativeEvent) {
      const touchEvent = event.nativeEvent as TouchEvent;
      const touchPoint = touchEvent.touches[0] || touchEvent.changedTouches[0];
      if (!touchPoint) return null;
      clientX = touchPoint.clientX;
      clientY = touchPoint.clientY;
    } else {
      const mouseEvent = event.nativeEvent as MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }
    const mouseX = (clientX - rect.left - pan.x) / zoom;
    const mouseY = (clientY - rect.top - pan.y) / zoom;

    const rad = -rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const cx = canvasDimensions.width / 2;
    const cy = canvasDimensions.height / 2;
    
    const translatedX = mouseX - cx;
    const translatedY = mouseY - cy;
    
    const unrotatedX = translatedX * cos - translatedY * sin;
    const unrotatedY = translatedX * sin + translatedY * cos;
    
    const x = unrotatedX + cx;
    const y = unrotatedY + cy;
    
    return { x, y };
  }, [zoom, pan, rotation, canvasDimensions]);

  const getSnappedLineEndPoint = useCallback(
    (
      startPoint: { x: number; y: number },
      currentPoint: { x: number; y: number }
    ): { point: { x: number; y: number }; snappedVp: VanishingPoint | null } => {
      const AXIS_COLORS = ['#ef4444', '#22C55E', '#3b82f6'];
      if (!AXIS_COLORS.includes(penColor) || vanishingPoints.length === 0) {
        return { point: currentPoint, snappedVp: null };
      }
  
      let bestVP: VanishingPoint | null = null;
      let minDistance = Infinity;
  
      if (Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) > 1) {
        for (const vp of vanishingPoints) {
          const dx = currentPoint.x - startPoint.x;
          const dy = currentPoint.y - startPoint.y;
          const dist = Math.abs(dy * vp.x - dx * vp.y + currentPoint.x * startPoint.y - currentPoint.y * startPoint.x) / Math.hypot(dx, dy);
          
          if (dist < minDistance) {
            minDistance = dist;
            bestVP = vp;
          }
        }
      } else {
        for (const vp of vanishingPoints) {
          const dist = Math.hypot(vp.x - startPoint.x, vp.y - startPoint.y);
          if (dist < minDistance) {
            minDistance = dist;
            bestVP = vp;
          }
        }
      }
      
      const SNAP_THRESHOLD = 30; // pixels
      if (bestVP && minDistance < SNAP_THRESHOLD) {
        const dirX = bestVP.x - startPoint.x;
        const dirY = bestVP.y - startPoint.y;
        const mag = Math.hypot(dirX, dirY);
  
        if (mag > 0) {
          const unitDirX = dirX / mag;
          const unitDirY = dirY / mag;
          
          const vecToCursorX = currentPoint.x - startPoint.x;
          const vecToCursorY = currentPoint.y - startPoint.y;
  
          const projectionLength = vecToCursorX * unitDirX + vecToCursorY * unitDirY;
          
          return {
            point: {
                x: startPoint.x + unitDirX * projectionLength,
                y: startPoint.y + unitDirY * projectionLength,
            },
            snappedVp: bestVP
          };
        }
      }
  
      return { point: currentPoint, snappedVp: null };
  }, [penColor, vanishingPoints]);

  const drawMarkerPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length === 0) return;

    ctx.fillStyle = markerColor;
    ctx.globalAlpha = markerOpacity;
    
    const angleInRadians = markerRotation * (Math.PI / 180);

    const stamp = (x: number, y: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angleInRadians);
        ctx.beginPath();
        
        if (markerShape === 'rectangle') {
          const width = markerSize / 3;
          const height = markerSize;
          ctx.rect(-width / 2, -height / 2, width, height);
        } else {
          const radius = markerSize / 2;
          ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        }
        
        ctx.fill();
        ctx.restore();
    };

    let lastPoint = points[0];
    stamp(lastPoint.x, lastPoint.y);

    for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i];
        const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
        const pointAngle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);
        
        const stepDimension = markerShape === 'rectangle' ? markerSize / 3 : markerSize;
        const step = stepDimension / 8; // Increased smoothing

        for (let d = step; d < dist; d += step) {
            const x = lastPoint.x + Math.cos(pointAngle) * d;
            const y = lastPoint.y + Math.sin(pointAngle) * d;
            stamp(x, y);
        }
        
        stamp(currentPoint.x, currentPoint.y);
        lastPoint = currentPoint;
    }
    
    ctx.globalAlpha = 1.0;
  }, [markerColor, markerSize, markerOpacity, markerRotation, markerShape]);

  const draw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const currentCoords = getCoords(event);
    if (!currentCoords) return;

    const isBrushTool = tool === 'pen' || tool === 'eraser' || tool === 'marker';
    if (isBrushTool) {
        if (!isDrawing) return;
        
        pointsRef.current.push(currentCoords);

        const previewCtx = previewLineCanvasRef.current?.getContext('2d');
        if (previewCtx && previewLineCanvasRef.current) {
            previewCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
            
            if (tool === 'pen') {
                previewCtx.strokeStyle = penColor;
                drawVariableWidthPath(previewCtx, pointsRef.current, penSize, penSensitivity);
            } else if (tool === 'marker') {
                drawMarkerPath(previewCtx, pointsRef.current);
            } else if (tool === 'eraser') {
                previewCtx.strokeStyle = '#000';
                previewCtx.lineWidth = eraserSize;
                previewCtx.lineCap = 'round';
                previewCtx.lineJoin = 'round';
                previewCtx.globalCompositeOperation = 'source-over';
                previewCtx.globalAlpha = 1.0;
                drawPath(previewCtx, pointsRef.current);
            }
        }
        return;
    }
    
    if (tool === 'perspective') {
        if (!draggingVPId) return;
        setVanishingPoints(prev => prev.map(vp => vp.id === draggingVPId ? { ...vp, x: currentCoords.x, y: currentCoords.y } : vp));
        return;
    }
    
    if (tool === 'curve') {
        const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
        if (!previewLineCtx || !previewLineCanvasRef.current) return;
        
        previewLineCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);

        const drawPointIndicator = (p: Point) => {
            previewLineCtx.save();
            previewLineCtx.fillStyle = '#fff';
            previewLineCtx.strokeStyle = '#3b82f6';
            previewLineCtx.lineWidth = 1.5 / zoom;
            previewLineCtx.beginPath();
            previewLineCtx.arc(p.x, p.y, 4 / zoom, 0, 2 * Math.PI);
            previewLineCtx.fill();
            previewLineCtx.stroke();
            previewLineCtx.restore();
        };
        curvePoints.forEach(p => drawPointIndicator(p));

        previewLineCtx.lineCap = 'round';
        previewLineCtx.strokeStyle = penColor;
        previewLineCtx.lineWidth = penSize;

        if (curvePoints.length === 1) { // P1 set, preview line to cursor for P2
            previewLineCtx.beginPath();
            previewLineCtx.moveTo(curvePoints[0].x, curvePoints[0].y);
            previewLineCtx.lineTo(currentCoords.x, currentCoords.y);
            previewLineCtx.stroke();
        } else if (curvePoints.length === 2) { // P1, P2 are set, previewing with CP1.
            const [p1, p2] = curvePoints;
            const cp1 = currentCoords;

            // Draw helper lines to the first control point
            previewLineCtx.save();
            previewLineCtx.strokeStyle = '#a0a0a0';
            previewLineCtx.lineWidth = 1 / zoom;
            previewLineCtx.setLineDash([2 / zoom, 4 / zoom]);
            previewLineCtx.beginPath(); previewLineCtx.moveTo(p1.x, p1.y); previewLineCtx.lineTo(cp1.x, cp1.y); previewLineCtx.stroke();
            previewLineCtx.beginPath(); previewLineCtx.moveTo(p2.x, p2.y); previewLineCtx.lineTo(cp1.x, cp1.y); previewLineCtx.stroke();
            previewLineCtx.restore();

            // Preview a quadratic curve to give immediate feedback
            previewLineCtx.strokeStyle = penColor;
            previewLineCtx.lineWidth = penSize;
            previewLineCtx.beginPath();
            previewLineCtx.moveTo(p1.x, p1.y);
            previewLineCtx.quadraticCurveTo(cp1.x, cp1.y, p2.x, p2.y);
            previewLineCtx.stroke();
        } else if (curvePoints.length === 3) { // Have P1, P2, CP1. Cursor is CP2. Preview cubic curve.
            const [p1, p2, cp1] = curvePoints;
            const cp2 = currentCoords;

            previewLineCtx.save(); // Draw helper lines from endpoints to control points
            previewLineCtx.strokeStyle = '#a0a0a0';
            previewLineCtx.lineWidth = 1 / zoom;
            previewLineCtx.setLineDash([2 / zoom, 4 / zoom]);
            previewLineCtx.beginPath(); previewLineCtx.moveTo(p1.x, p1.y); previewLineCtx.lineTo(cp1.x, cp1.y); previewLineCtx.stroke();
            previewLineCtx.beginPath(); previewLineCtx.moveTo(p2.x, p2.y); previewLineCtx.lineTo(cp2.x, cp2.y); previewLineCtx.stroke();
            previewLineCtx.restore();

            previewLineCtx.strokeStyle = penColor; // Draw curve
            previewLineCtx.lineWidth = penSize;
            previewLineCtx.beginPath();
            previewLineCtx.moveTo(p1.x, p1.y);
            previewLineCtx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
            previewLineCtx.stroke();
        }
        return;
    }

    if (!isDrawing) return;

    if (tool === 'line' && lineStartPoint) {
      const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
      if (previewLineCtx && previewLineCanvasRef.current) {
        previewLineCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
        previewLineCtx.lineCap = 'round';
        previewLineCtx.strokeStyle = penColor;
        previewLineCtx.lineWidth = penSize;
        const { point: endPoint, snappedVp } = getSnappedLineEndPoint(lineStartPoint, currentCoords);
        previewLineCtx.beginPath();
        previewLineCtx.moveTo(lineStartPoint.x, lineStartPoint.y);
        previewLineCtx.lineTo(endPoint.x, endPoint.y);
        previewLineCtx.stroke();

        if (snappedVp) {
            previewLineCtx.save();
            previewLineCtx.strokeStyle = snappedVp.id === activeVPId ? '#3b82f6' : '#a0a0a0';
            previewLineCtx.lineWidth = 1;
            previewLineCtx.setLineDash([3, 5]);
            previewLineCtx.beginPath();
            previewLineCtx.moveTo(endPoint.x, endPoint.y);
            previewLineCtx.lineTo(snappedVp.x, snappedVp.y);
            previewLineCtx.stroke();
            previewLineCtx.restore();
        }
      }
      return;
    }

    if (tool === 'ellipse' && ellipseStartPoint) {
      const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
      if (previewLineCtx && previewLineCanvasRef.current) {
          previewLineCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
          previewLineCtx.lineCap = 'round';
          previewLineCtx.strokeStyle = penColor;
          previewLineCtx.lineWidth = penSize;
          drawEllipse(previewLineCtx, ellipseStartPoint, currentCoords);
      }
      return;
    }
  }, [isDrawing, getCoords, tool, draggingVPId, curvePoints, penColor, penSize, penSensitivity, eraserSize, lineStartPoint, ellipseStartPoint, getSnappedLineEndPoint, vanishingPoints, activeVPId, drawMarkerPath, zoom]);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (event.altKey && 'button' in event.nativeEvent && (event.nativeEvent as MouseEvent).button === 2) {
        event.preventDefault();
        setIsScrubbyZooming(true);
        panStartRef.current = { x: (event.nativeEvent as MouseEvent).clientX, y: (event.nativeEvent as MouseEvent).clientY };
        return;
    }

    const isMiddleClick = 'button' in event.nativeEvent && (event.nativeEvent as MouseEvent).button === 1;
    if (isSpacePressed || isMiddleClick) {
        event.preventDefault();
        setIsPanning(true);
        const point = 'touches' in event.nativeEvent ? event.nativeEvent.touches[0] : event.nativeEvent as MouseEvent;
        panStartRef.current = { x: point.clientX, y: point.clientY };
        return;
    }

    const coords = getCoords(event);
    if (!coords) return;
    
    const isNewDrawingOperation =
      tool === 'pen' ||
      tool === 'marker' ||
      tool === 'eraser' ||
      tool === 'ellipse' ||
      tool === 'line' ||
      (tool === 'curve');

    const isPrimaryAction = 'button' in event.nativeEvent ? (event.nativeEvent as MouseEvent).button === 0 : true;

    if (isNewDrawingOperation && isPrimaryAction) {
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer) {
        saveState();
      }
    }

    if ('touches' in event.nativeEvent) {
        lastTouchesRef.current = event.nativeEvent.touches;
        if (event.nativeEvent.touches.length > 1) {
            return;
        }
    }
    
    if (tool === 'line') {
        if ('button' in event.nativeEvent && (event.nativeEvent as MouseEvent).button !== 0) return;
        const ctx = getActiveContext();
        if (ctx) {
            setLineStartPoint(coords);
            setIsDrawing(true);
        }
        return;
    }
    
    if (tool === 'point_placer') {
        const activeLayer = layers.find(l => l.id === activeLayerId);
        if (!activeLayer) return;

        const characterName = activeLayer.name;
        const existingPoint = activeLayer.points?.find(p => p.characterName === characterName);
        
        const x = (coords.x / canvasDimensions.width) * 100;
        const y = (coords.y / canvasDimensions.height) * 100;

        if (existingPoint) {
            setLayers(prev => prev.map(l => {
                if (l.id !== activeLayerId) return l;
                return {
                    ...l,
                    points: l.points?.map(p => 
                        p.id === existingPoint.id
                            ? { ...p, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
                            : p
                    )
                };
            }));
        } else {
            const newPoint: CharacterPoint = {
              id: Date.now(),
              x: Math.max(0, Math.min(100, x)),
              y: Math.max(0, Math.min(100, y)),
              characterName: characterName,
              radius: 15,
              color: generateRandomColor(),
            };
            
            setLayers(prev => prev.map(l => 
                l.id === activeLayerId 
                    ? { ...l, points: [...(l.points || []), newPoint] }
                    : l
            ));
        }
        debouncedOnCanvasChange();
        return;
    }
    
    const isBrushTool = tool === 'pen' || tool === 'eraser' || tool === 'marker';
    if (isBrushTool) {
        setIsDrawing(true);
        pointsRef.current = [coords];
        return;
    }

    if (tool === 'perspective') {
        const HIT_RADIUS = 15 / zoom;
        const clickedVP = vanishingPoints.find(vp => Math.hypot(coords.x - vp.x, coords.y - vp.y) < HIT_RADIUS);
        if (clickedVP) {
            setActiveVPId(clickedVP.id);
            setDraggingVPId(clickedVP.id);
        } else {
            const newVP = { id: Date.now(), x: coords.x, y: coords.y };
            setVanishingPoints(prev => [...prev, newVP]);
            setActiveVPId(newVP.id);
            setDraggingVPId(newVP.id);
        }
        return;
    }
    
    if (tool === 'curve') {
        if (curvePoints.length === 3) { // On 4th click, complete the curve
            const ctx = getActiveContext();
            if (ctx) {
                const [start, end, cp1] = curvePoints;
                const cp2 = coords;
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                ctx.stroke();
            }
            const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
            previewLineCtx?.clearRect(0, 0, previewLineCanvasRef.current!.width, previewLineCanvasRef.current!.height);
            setCurvePoints([]);
            saveState();
            redrawPreview();
            debouncedOnCanvasChange();
        } else { // Collect points for the curve
            setCurvePoints(prev => [...prev, coords]);
        }
        return;
    }

    const ctx = getActiveContext();
    if (ctx) {
        setIsDrawing(true);
        if (tool === 'ellipse') {
            setEllipseStartPoint(coords);
        }
    }
  }, [getCoords, tool, zoom, vanishingPoints, curvePoints, getActiveContext, saveState, redrawPreview, debouncedOnCanvasChange, isSpacePressed, layers, activeLayerId, canvasDimensions]);

  const drawEllipse = (ctx: CanvasRenderingContext2D, start: {x: number, y: number}, end: {x: number, y: number}) => {
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    const centerX = Math.min(start.x, end.x) + radiusX;
    const centerY = Math.min(start.y, end.y) + radiusY;

    if (radiusX === 0 || radiusY === 0) return;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const stopDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'line') {
        if (!isDrawing || !lineStartPoint) return;
        const ctx = getActiveContext();
        const currentCoords = getCoords(event);
        if (ctx && currentCoords) {
            const { point: endPoint } = getSnappedLineEndPoint(lineStartPoint, currentCoords);
            ctx.beginPath();
            ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
            ctx.lineTo(endPoint.x, endPoint.y);
            ctx.stroke();
        }
        const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
        previewLineCtx?.clearRect(0, 0, previewLineCanvasRef.current!.width, previewLineCanvasRef.current!.height);
        setIsDrawing(false);
        setLineStartPoint(null);
        redrawPreview();
        debouncedOnCanvasChange();
        return;
    }
    
    if (resizingPoint) {
        setResizingPoint(null);
        debouncedOnCanvasChange();
    }
    if (draggingPoint) {
        setDraggingPoint(null);
        debouncedOnCanvasChange();
    }
    if (isScrubbyZooming) {
        setIsScrubbyZooming(false);
        return;
    }
    if (isPanning) {
        setIsPanning(false);
    }
    
    if ('touches' in event.nativeEvent) {
        lastTouchesRef.current = event.nativeEvent.touches;
    }
    
    const isBrushTool = tool === 'pen' || tool === 'eraser' || tool === 'marker';

    if (isBrushTool) {
        if (!isDrawing) return;
        
        const ctx = getActiveContext();
        if (ctx) {
            if (tool === 'pen') {
                ctx.strokeStyle = penColor;
                drawVariableWidthPath(ctx, pointsRef.current, penSize, penSensitivity);
            } else if (tool === 'marker') {
                drawMarkerPath(ctx, pointsRef.current);
            } else { // eraser
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = eraserSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                drawPath(ctx, pointsRef.current);
            }
        }

        const previewCtx = previewLineCanvasRef.current?.getContext('2d');
        if (previewLineCanvasRef.current) {
            previewCtx?.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
        }

        pointsRef.current = [];
        setIsDrawing(false);
        redrawPreview();
        debouncedOnCanvasChange();
        return;
    }
      
    if (tool === 'perspective') {
        setDraggingVPId(null);
        return;
    }
    
    if (tool === 'curve') {
        return;
    }
    if (!isDrawing) return;
    const ctx = getActiveContext();
    const currentCoords = getCoords(event);

    if (tool === 'ellipse' && ellipseStartPoint && currentCoords && ctx) {
        const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
        previewLineCtx?.clearRect(0, 0, previewLineCanvasRef.current!.width, previewLineCanvasRef.current!.height);
        drawEllipse(ctx, ellipseStartPoint, currentCoords);
    }
    
    setIsDrawing(false);
    setLineStartPoint(null);
    setEllipseStartPoint(null);
    redrawPreview();
    debouncedOnCanvasChange();
  }, [isDrawing, redrawPreview, debouncedOnCanvasChange, getActiveContext, tool, ellipseStartPoint, markerColor, markerOpacity, getCoords, isPanning, isScrubbyZooming, drawMarkerPath, penColor, penSize, penSensitivity, eraserSize, draggingPoint, resizingPoint, lineStartPoint, getSnappedLineEndPoint]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (resizingPoint) {
        const dx = e.clientX - resizingPoint.startMouseX;
        const realDx = dx / zoom;
        let newRadiusPixels = resizingPoint.startRadiusPixels + realDx;
        newRadiusPixels = Math.max(20, newRadiusPixels);
        const newRadiusPercent = (newRadiusPixels / canvasDimensions.width) * 100;

        setLayers(prevLayers => prevLayers.map(l => {
            if (l.id !== resizingPoint.layerId) return l;
            return {
                ...l,
                points: l.points?.map(p => 
                    p.id === resizingPoint.pointId ? { ...p, radius: newRadiusPercent } : p
                )
            };
        }));
        return;
    }
    if (draggingPoint) {
        const coords = getCoords(e);
        if (!coords) return;
        
        const newX = (coords.x / canvasDimensions.width) * 100;
        const newY = (coords.y / canvasDimensions.height) * 100;

        setLayers(prevLayers => prevLayers.map(l => {
            if (l.id !== draggingPoint.layerId) return l;
            return {
                ...l,
                points: l.points?.map(p => {
                    if (p.id !== draggingPoint.pointId) return p;
                    return {
                        ...p,
                        x: Math.max(0, Math.min(100, newX)),
                        y: Math.max(0, Math.min(100, newY)),
                    };
                })
            };
        }));
        return;
    }
    if (isScrubbyZooming) {
        const dx = e.clientX - panStartRef.current.x;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        const zoomFactor = Math.pow(1.01, dx);
        const container = canvasContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setZoom(prevZoom => {
            const newZoom = prevZoom * zoomFactor;
            const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            setPan(prevPan => {
                const pointOnCanvas = { x: (mousePos.x - prevPan.x) / prevZoom, y: (mousePos.y - prevPan.y) / prevZoom };
                return { x: mousePos.x - pointOnCanvas.x * clampedZoom, y: mousePos.y - pointOnCanvas.y * clampedZoom };
            });
            return clampedZoom;
        });
        return;
    }
    if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        return;
    }

    const needsPreview = isDrawing ||
        (tool === 'line' && lineStartPoint) ||
        (tool === 'curve' && curvePoints.length > 0) ||
        (tool === 'ellipse' && ellipseStartPoint) ||
        (tool === 'perspective' && draggingVPId !== null);

    if (needsPreview) {
        draw(e);
    }

    const container = canvasContainerRef.current;
    if (container) {
        if (isSpacePressed) {
            container.style.cursor = isPanning ? 'grabbing' : 'grab';
        } else if (tool === 'point_placer' || tool === 'point_deleter') {
            container.style.cursor = 'crosshair';
        } else {
            container.style.cursor = tool === 'perspective' ? 'default' : 'crosshair';
        }
    }
  }, [draw, isDrawing, tool, isPanning, isScrubbyZooming, isSpacePressed, lineStartPoint, curvePoints, ellipseStartPoint, draggingVPId, draggingPoint, getCoords, canvasDimensions, resizingPoint, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touchEvent = e.nativeEvent as TouchEvent;
    
    if (touchEvent.touches.length >= 2 && lastTouchesRef.current && lastTouchesRef.current.length >= 2) {
        const t1 = touchEvent.touches[0];
        const t2 = touchEvent.touches[1];
        const lastT1 = lastTouchesRef.current[0];
        const lastT2 = lastTouchesRef.current[1];
        
        const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const lastDist = Math.hypot(lastT1.clientX - lastT2.clientX, lastT1.clientY - lastT2.clientY);
        
        const newMidpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        const lastMidpoint = { x: (lastT1.clientX + lastT2.clientX) / 2, y: (lastT1.clientY + lastT2.clientY) / 2 };
        
        const panDx = newMidpoint.x - lastMidpoint.x;
        const panDy = newMidpoint.y - lastMidpoint.y;

        const zoomFactor = lastDist > 0 ? newDist / lastDist : 1;

        const container = canvasContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const midpointInContainer = { x: newMidpoint.x - rect.left, y: newMidpoint.y - rect.top };
        
        const newPan = { x: pan.x + panDx, y: pan.y + panDy };
        const newZoom = zoom * zoomFactor;
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        
        const dxFromZoom = (midpointInContainer.x - newPan.x) * (1 - clampedZoom / zoom);
        const dyFromZoom = (midpointInContainer.y - newPan.y) * (1 - clampedZoom / zoom);

        setZoom(clampedZoom);
        setPan({ x: newPan.x + dxFromZoom, y: newPan.y + dyFromZoom });

    } else if (touchEvent.touches.length === 1 && isDrawing) {
        draw(e);
    }
    
    lastTouchesRef.current = touchEvent.touches;
  }, [isDrawing, draw, pan, zoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          setIsSpacePressed(true);
      }

      if (e.key === 'Escape') {
        if (lineStartPoint) {
            setLineStartPoint(null);
        } else if (ellipseStartPoint) {
            setEllipseStartPoint(null);
        } else if (curvePoints.length > 0) {
            setCurvePoints([]);
        }
        const previewLineCtx = previewLineCanvasRef.current?.getContext('2d');
        previewLineCtx?.clearRect(0, 0, previewLineCanvasRef.current!.width, previewLineCanvasRef.current!.height);
      }
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeVPId) {
        e.preventDefault();
        setVanishingPoints(vps => vps.filter(vp => vp.id !== activeVPId));
        setActiveVPId(null);
        return;
      }
      
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const direction = e.key === ']' ? 1 : -1;

        switch (tool) {
          case 'pen':
          case 'line':
          case 'curve':
          case 'ellipse':
            setPenSize(s => Math.max(1, Math.min(50, s + (step * direction))));
            break;
          case 'marker':
             setMarkerSize(s => Math.max(1, Math.min(100, s + (step * direction))));
            break;
          case 'eraser':
            setEraserSize(s => Math.max(1, Math.min(100, s + (step * direction))));
            break;
        }
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setTool('pen');
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setTool('marker');
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setTool('eraser');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            setIsSpacePressed(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, activeVPId, tool, lineStartPoint, curvePoints, ellipseStartPoint]);
  
  const clearActiveLayer = useCallback(() => {
    const ctx = getActiveContext();
    const canvas = activeLayerId ? canvasRefs.current[activeLayerId] : null;
    if (canvas && ctx) {
      saveState();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
      redrawPreview();
      debouncedOnCanvasChange();
    }
  }, [getActiveContext, activeLayerId, redrawPreview, saveState, debouncedOnCanvasChange]);
  
  const handleZoomButtonClick = (direction: 'in' | 'out') => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const anchor = { x: rect.width / 2, y: rect.height / 2 };

    const newZoom = direction === 'in' ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    
    const pointOnCanvas = {
        x: (anchor.x - pan.x) / zoom,
        y: (anchor.y - pan.y) / zoom,
    };

    setPan({
        x: anchor.x - pointOnCanvas.x * clampedZoom,
        y: anchor.y - pointOnCanvas.y * clampedZoom,
    });
    setZoom(clampedZoom);
  };

  const resetView = () => {
    setZoom(1);
    setPan({x: 0, y: 0});
    setRotation(0);
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.altKey) {
        const rotationAmount = e.deltaY > 0 ? -2 : 2;
        setRotation(prev => prev + rotationAmount);
        return;
    }

    const container = e.currentTarget;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
    const direction = e.deltaY > 0 ? 'out' : 'in';

    setZoom(prevZoom => {
        const newZoom = direction === 'in' ? prevZoom * ZOOM_STEP : prevZoom / ZOOM_STEP;
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

        if (clampedZoom === prevZoom) return prevZoom;

        setPan(prevPan => {
            const pointOnCanvas = {
                x: (anchor.x - prevPan.x) / prevZoom,
                y: (anchor.y - prevPan.y) / prevZoom,
            };
            return {
                x: anchor.x - pointOnCanvas.x * clampedZoom,
                y: anchor.y - pointOnCanvas.y * clampedZoom,
            };
        });
        return clampedZoom;
    });
  }, []);

  const deleteLayer = useCallback((id: number) => {
    setLayers(prevLayers => {
        if (prevLayers.length <= 1) {
            return prevLayers;
        }
        
        setHistory(prev => {
            const newHistory = { ...prev };
            delete newHistory[id];
            return newHistory;
        });
        
        const layerIndex = prevLayers.findIndex(l => l.id === id);
        const newLayers = prevLayers.filter(l => l.id !== id);
        
        if (activeLayerId === id) {
          setActiveLayerId(newLayers[Math.max(0, layerIndex - 1)]?.id || null);
        }
        return newLayers;
    });
  }, [activeLayerId]);

  const deletePoint = useCallback((pointId: number) => {
      setLayers(prev => prev.map(layer => ({
          ...layer,
          points: layer.points?.filter(p => p.id !== pointId)
      })));
      debouncedOnCanvasChange();
  }, [debouncedOnCanvasChange]);

  const handlePointMouseDown = (e: React.MouseEvent, layerId: number, pointId: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingPoint({ layerId, pointId });
  };
  
  const handlePointResizeStart = (e: React.MouseEvent, layerId: number, pointId: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const pointToResize = layers.find(l => l.id === layerId)?.points?.find(p => p.id === pointId);
    if (!pointToResize) return;

    setResizingPoint({
        layerId,
        pointId,
        startMouseX: e.clientX,
        startRadiusPixels: (pointToResize.radius / 100) * canvasDimensions.width,
    });
  };

  const moveLayer = useCallback((id: number, direction: 'up' | 'down') => {
    setLayers(prev => {
        const index = prev.findIndex(l => l.id === id);
        if ((direction === 'up' && index >= prev.length - 1) || (direction === 'down' && index <= 0)) {
            return prev;
        }
        const newLayers = [...prev];
        const targetIndex = direction === 'up' ? index + 1 : index - 1;
        [newLayers[index], newLayers[targetIndex]] = [newLayers[targetIndex], newLayers[index]];
        return newLayers;
    });
  }, []);

  const mergeLayerDown = (id: number) => {
    const index = layers.findIndex(l => l.id === id);
    if (index <= 0) return;
    const topLayer = layers[index];
    const bottomLayer = layers[index - 1];

    const topCanvas = canvasRefs.current[topLayer.id];
    const bottomCanvas = canvasRefs.current[bottomLayer.id];
    const bottomCtx = bottomCanvas?.getContext('2d');
    if (topCanvas && bottomCtx) {
        saveState(); // Save state before merge
        bottomCtx.globalAlpha = 1.0;
        bottomCtx.globalCompositeOperation = topLayer.blendMode;
        bottomCtx.drawImage(topCanvas, 0, 0);
        bottomCtx.globalCompositeOperation = 'source-over';
        redrawPreview();
        deleteLayer(id);
        const currentActive = activeLayerId;
        setActiveLayerId(bottomLayer.id);
        setTimeout(() => {
            saveState(); // Save state after merge
            setActiveLayerId(currentActive === id ? bottomLayer.id : currentActive);
        }, 0);
    }
  };

  const toggleVisibility = useCallback((id: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, isVisible: !l.isVisible } : l));
  }, []);
  
  const handleLayerNameChange = useCallback((id: number, newName: string) => {
    setLayers(prev =>
      prev.map(l =>
        l.id === id && newName.trim() ? { ...l, name: newName.trim() } : l
      )
    );
    setEditingLayerId(null);
  }, []);
  
  const handleBlendModeChange = (id: number, blendMode: GlobalCompositeOperation) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, blendMode } : l));
  };
  
  const handleOpacityChange = (id: number, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };
  
  const ToolDivider = () => <div className="w-px h-8 bg-neutral-600 self-center"></div>;
  
  const activeHistory = activeLayerId ? history[activeLayerId] : null;
  const canUndo = activeHistory ? activeHistory.index > 0 : false;
  const canRedo = activeHistory ? activeHistory.index < activeHistory.stack.length - 1 : false;
  
  const activeLayer = layers.find(l => l.id === activeLayerId);


  return (
    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
      <div className="flex items-center flex-wrap gap-x-4 gap-y-3 my-4 p-2 bg-neutral-800/60 rounded-lg border border-neutral-700/80">
        <div className="flex items-center gap-2 px-2" role="group" aria-label="도구 선택">
          <span className="text-sm font-medium text-neutral-300">도구</span>
          <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
            <button type="button" onClick={() => setTool('pen')} className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'pen'} title="펜 (B)"><PenIcon /></button>
            <button type="button" onClick={() => setTool('marker')} className={`p-2 rounded-md transition-colors ${tool === 'marker' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'marker'} title="마커 (음영) (M)"><MarkerIcon /></button>
            <button type="button" onClick={() => setTool('line')} className={`p-2 rounded-md transition-colors ${tool === 'line' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'line'} title="직선"><LineIcon /></button>
            <button type="button" onClick={() => setTool('curve')} className={`p-2 rounded-md transition-colors ${tool === 'curve' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'curve'} title="곡선"><CurveIcon /></button>
            <button type="button" onClick={() => setTool('ellipse')} className={`p-2 rounded-md transition-colors ${tool === 'ellipse' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'ellipse'} title="타원"><EllipseIcon /></button>
            <button type="button" onClick={() => setTool('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'eraser'} title="지우개 (E)"><EraserIcon /></button>
            <button type="button" onClick={() => setTool('point_placer')} className={`p-2 rounded-md transition-colors ${tool === 'point_placer' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'point_placer'} title="포인트 지정"><TargetIcon /></button>
            <button type="button" onClick={() => setTool('point_deleter')} className={`p-2 rounded-md transition-colors ${tool === 'point_deleter' ? 'bg-red-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'point_deleter'} title="포인트 삭제"><TrashIcon /></button>
          </div>
        </div>
        <ToolDivider />
        <div className="flex items-center gap-4 px-2" role="group" aria-label="도구 옵션">
          <span className="text-sm font-medium text-neutral-300">옵션</span>
          {(tool === 'pen' || tool === 'line' || tool === 'curve' || tool === 'ellipse') && (
            <div className="flex items-center flex-wrap gap-4">
                 <ColorPickerSelect
                    selectedColor={penColor}
                    onSelectColor={setPenColor}
                />
                <div className="flex items-center gap-2">
                    <label htmlFor="pen-size" className="sr-only">펜 굵기</label>
                    <PenIcon />
                    <input id="pen-size" type="range" min="1" max="50" value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500" title={`펜 굵기: ${penSize}`}/>
                    <span className="w-6 text-center font-mono text-xs">{penSize}</span>
                </div>
                {tool === 'pen' && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="pen-sensitivity" className="sr-only">펜 감도</label>
                        <CurveIcon width="16" height="16" />
                        <input id="pen-sensitivity" type="range" min="0" max="1" step="0.05" value={penSensitivity} onChange={(e) => setPenSensitivity(Number(e.target.value))} className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500" title={`펜 감도: ${penSensitivity.toFixed(2)}`}/>
                        <span className="w-8 text-center font-mono text-xs">{penSensitivity.toFixed(2)}</span>
                    </div>
                )}
            </div>
          )}
          {tool === 'point_placer' && (
             <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm text-neutral-400">
                    포인트 지정: <strong className="text-neutral-200">{activeLayer?.name || '레이어 선택 필요'}</strong>
                </span>
             </div>
          )}
          {tool === 'marker' && (
            <div className="flex items-center flex-wrap gap-4">
              <ColorPickerSelect
                  selectedColor={markerColor}
                  onSelectColor={setMarkerColor}
              />
               <div className="flex items-center gap-1" role="group" aria-label="마커 모양">
                <button type="button" onClick={() => setMarkerShape('rectangle')} className={`p-2 rounded-md transition-colors ${markerShape === 'rectangle' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} title="직사각형 마커"><RectangleIcon width="16" height="16"/></button>
                <button type="button" onClick={() => setMarkerShape('circle')} className={`p-2 rounded-md transition-colors ${markerShape === 'circle' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} title="원형 마커"><CircleIcon width="16" height="16"/></button>
              </div>
              <div className="flex items-center gap-2">
                    <label htmlFor="marker-size" className="sr-only">마커 굵기</label>
                    <MarkerIcon width="16" height="16" />
                    <input id="marker-size" type="range" min="1" max="100" value={markerSize} onChange={(e) => setMarkerSize(Number(e.target.value))} className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500" title={`마커 굵기: ${markerSize}`}/>
                    <span className="w-6 text-center font-mono text-xs">{markerSize}</span>
                </div>
              <div className="flex items-center gap-2">
                  <label htmlFor="marker-opacity" className="sr-only">불투명도</label>
                  <OpacityIcon />
                  <input id="marker-opacity" type="range" min="0.01" max="1" step="0.01" value={markerOpacity} onChange={(e) => setMarkerOpacity(Number(e.target.value))} className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500" title={`불투명도: ${Math.round(markerOpacity*100)}%`}/>
                  <span className="w-8 text-center font-mono text-xs">{Math.round(markerOpacity*100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                  <label htmlFor="marker-rotation" className="sr-only">마커 각도</label>
                  <AngleIcon className={markerShape === 'circle' ? 'text-neutral-500' : ''} />
                  <input id="marker-rotation" type="range" min="0" max="180" value={markerRotation} onChange={(e) => setMarkerRotation(Number(e.target.value))} className="w-24 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" title={`마커 각도: ${markerRotation}°`} disabled={markerShape === 'circle'}/>
                  <span className={`w-8 text-center font-mono text-xs ${markerShape === 'circle' ? 'text-neutral-500' : ''}`}>{markerRotation}°</span>
              </div>
            </div>
          )}
          {tool === 'eraser' && (
            <div className="flex items-center gap-2">
                <label htmlFor="eraser-size" className="sr-only">지우개 굵기</label>
                <EraserIcon />
                <input id="eraser-size" type="range" min="1" max="100" value={eraserSize} onChange={(e) => setEraserSize(Number(e.target.value))} className="w-32 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500" title={`지우개 굵기: ${eraserSize}`}/>
                <span className="w-6 text-center font-mono text-xs">{eraserSize}</span>
            </div>
          )}
        </div>
        <ToolDivider />
        <div className="flex items-center gap-2 px-2" role="group" aria-label="실행 취소/다시 실행">
            <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
              <button type="button" onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed" title="실행 취소 (Ctrl+Z)"><UndoIcon /></button>
              <button type="button" onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed" title="다시 실행 (Ctrl+Y)"><RedoIcon /></button>
            </div>
        </div>
        <ToolDivider />
        <div className="flex items-center gap-2 px-2" role="group" aria-label="캔버스 보기 설정">
            <span className="text-sm font-medium text-neutral-300">보기</span>
            <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
              <button type="button" onClick={() => handleZoomButtonClick('out')} disabled={zoom <= MIN_ZOOM} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600 disabled:opacity-50" title="축소"><ZoomOutIcon /></button>
              <button type="button" onClick={resetView} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600" title="보기 초기화"><ExpandIcon /></button>
              <button type="button" onClick={() => handleZoomButtonClick('in')} disabled={zoom >= MAX_ZOOM} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600 disabled:opacity-50" title="확대"><ZoomInIcon /></button>
            </div>
        </div>
        <ToolDivider />
        <div className="flex items-center gap-2 px-2" role="group" aria-label="캔버스 회전">
            <span className="text-sm font-medium text-neutral-300">회전</span>
            <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
                <button type="button" onClick={() => setRotation(r => r - 15)} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600" title="반시계 방향 회전 (15°)">
                    <RotateCcwIcon />
                </button>
                <button type="button" onClick={() => setRotation(0)} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600" title="회전 초기화">
                    <ResetIcon />
                </button>
                <button type="button" onClick={() => setRotation(r => r + 15)} className="p-2 rounded-md transition-colors text-neutral-300 hover:bg-neutral-600" title="시계 방향 회전 (15°)">
                    <RotateCwIcon />
                </button>
            </div>
            <input 
                type="range" 
                min="-180" 
                max="180" 
                value={rotation} 
                onChange={e => setRotation(Number(e.target.value))} 
                className="w-24 h-1.5 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title={`회전: ${Math.round(rotation)}°`}
            />
            <span className="w-10 text-center font-mono text-xs">{Math.round(rotation)}°</span>
        </div>
        <ToolDivider />
        <div className="flex items-center gap-2 px-2" role="group" aria-label="렌즈 설정">
          <label htmlFor="canvas-lens" className="text-sm font-medium text-neutral-300">렌즈</label>
          <select 
            id="canvas-lens"
            value={lens} 
            onChange={e => setLens(e.target.value)}
            className="p-1.5 text-sm bg-neutral-700 border border-neutral-600 rounded-md"
            title="캔버스 퍼스펙티브 렌즈 설정"
          >
            {lensOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <ToolDivider />
        <div className="flex items-center flex-wrap gap-2 px-2" role="group" aria-label="보조선 도구">
            <span className="text-sm font-medium text-neutral-300">보조선</span>
            <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
              <button type="button" onClick={() => setTool('perspective')} className={`p-2 rounded-md transition-colors ${tool === 'perspective' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} aria-pressed={tool === 'perspective'} title="소실점"><TargetIcon /></button>
            </div>
            {vanishingPoints.length > 0 && (
              <button type="button" onClick={() => { setVanishingPoints([]); setActiveVPId(null); }} className="px-3 py-1.5 bg-neutral-700 text-red-400 hover:bg-neutral-600 text-sm font-medium rounded-md transition-colors flex items-center gap-2" title="모든 소실점을 삭제합니다">
                <TrashIcon />
                소실점 지우기
              </button>
            )}
        </div>
        <div className="px-2 flex items-center gap-2" role="group" aria-label="레이어 및 선택 작업">
            <button type="button" onClick={clearActiveLayer} className="px-3 py-1.5 bg-neutral-700 text-red-400 hover:bg-neutral-600 text-sm font-medium rounded-md transition-colors flex items-center gap-2" title="현재 활성화된 레이어의 모든 그림을 지웁니다">
              <TrashIcon />
              레이어 지우기
            </button>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="relative flex-grow">
          {isResizing && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50 rounded-md">
              <div className="bg-neutral-800 text-white font-mono p-2 rounded-lg shadow-lg flex items-center gap-2">
                <LockIcon className="w-4 h-4 text-neutral-400" />
                <span>{Math.round(canvasDimensions.width)} x {Math.round(canvasDimensions.height)}</span>
              </div>
            </div>
          )}
          <div 
            ref={canvasContainerRef} 
            className="flex-grow w-full rounded-md border border-neutral-700/50 overflow-hidden bg-neutral-600 touch-none relative"
            onWheel={handleWheel}
            onMouseDown={startDrawing} 
            onMouseMove={handleMouseMove} 
            onMouseUp={stopDrawing} 
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={stopDrawing}
            onContextMenu={(e) => {
              if (isScrubbyZooming || isPanning || isSpacePressed || draggingPoint || (tool === 'line' && isDrawing)) {
                e.preventDefault();
              }
            }}
          >
            <div 
              className="absolute top-2 left-2 text-white bg-black/40 px-2 py-1 rounded text-xs font-mono pointer-events-none z-10"
              aria-hidden="true"
            >
              LEFT (좌)
            </div>
            <div 
              className="absolute top-2 right-2 text-white bg-black/40 px-2 py-1 rounded text-xs font-mono pointer-events-none z-10"
              aria-hidden="true"
            >
              RIGHT (우)
            </div>
            <div 
                className="relative"
                style={{ 
                    width: canvasDimensions.width, 
                    height: canvasDimensions.height, 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
                    transformOrigin: 'top left', 
                }}
            >
                <div
                    className="absolute top-0 left-0 w-full h-full"
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                    }}
                >
                    <canvas
                        ref={previewCanvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        className="absolute top-0 left-0 pointer-events-none"
                    />
                    <canvas
                        ref={perspectiveCanvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        className="absolute top-0 left-0 pointer-events-none"
                    />
                    {layers.map(layer => (
                    <React.Fragment key={layer.id}>
                        <canvas
                        ref={el => { canvasRefs.current[layer.id] = el; }}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        className="absolute top-0 left-0 pointer-events-none hidden"
                        />
                    </React.Fragment>
                    ))}
                    <canvas
                        ref={previewLineCanvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        className="absolute top-0 left-0 pointer-events-none"
                    />
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      {layers.map(layer => layer.isVisible && layer.points?.map(point => {
                          const radiusInPixels = (point.radius / 100) * canvasDimensions.width;
                          const colorWithAlpha = point.color.replace('hsl', 'hsla').replace(')', ', 0.25)');
                          const colorWithoutAlpha = point.color.replace('hsl', 'hsla').replace(')', ', 0)');
                          const borderColorWithAlpha = point.color.replace('hsl', 'hsla').replace(')', ', 0.3)');
                          return (
                            <div
                                key={point.id}
                                className="absolute group"
                                style={{
                                    left: `${point.x}%`,
                                    top: `${point.y}%`,
                                    zIndex: (draggingPoint?.pointId === point.id || resizingPoint?.pointId === point.id) ? 10 : 1,
                                }}
                            >
                                <div
                                    className="absolute rounded-full transition-opacity duration-300 pointer-events-none"
                                    style={{
                                        width: `${radiusInPixels * 2}px`,
                                        height: `${radiusInPixels * 2}px`,
                                        transform: 'translate(-50%, -50%)',
                                        background: `radial-gradient(circle, ${colorWithAlpha} 0%, ${colorWithoutAlpha} 65%)`,
                                        border: `1px solid ${borderColorWithAlpha}`,
                                        opacity: (draggingPoint?.pointId === point.id || resizingPoint?.pointId === point.id) ? 0.9 : 0.7,
                                    }}
                                />
                                <div
                                    className={`relative flex items-center z-10 ${tool === 'point_deleter' ? 'cursor-pointer' : 'cursor-move'}`}
                                    style={{ pointerEvents: 'auto', transform: 'translate(-50%, -50%)' }}
                                    onMouseDown={(e) => {
                                      if (tool === 'point_deleter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        deletePoint(point.id);
                                      } else {
                                        handlePointMouseDown(e, layer.id, point.id)
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    title={`${point.characterName} (드래그하여 이동)`}
                                >
                                  <div 
                                    className="w-4 h-4 rounded-full border-2 border-white/80 shadow-md flex items-center justify-center transition-all duration-300"
                                    style={{ backgroundColor: point.color }}
                                  >
                                    <div 
                                      className="absolute right-0 top-0 bottom-0 w-12 cursor-ew-resize opacity-0 group-hover:opacity-100"
                                      style={{ pointerEvents: 'auto' }}
                                      onMouseDown={(e) => handlePointResizeStart(e, layer.id, point.id)}
                                      title="드래그하여 반경 변경"
                                    ></div>
                                    {tool === 'point_deleter' && <TrashIcon width="8" height="8" className="text-white"/>}
                                  </div>
                                </div>
                                <div
                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-0.5 bg-black/60 text-white text-xs font-semibold rounded-md whitespace-nowrap pointer-events-none"
                                >
                                    {point.characterName}
                                </div>
                            </div>
                          );
                      }))}
                    </div>
                </div>
            </div>
          </div>
          <div
              className="absolute right-0 top-0 bottom-0 w-2 group cursor-ew-resize"
              onMouseDown={(e) => handleResizeMouseDown(e, 'r')}
            >
              <div className="w-0.5 h-full bg-neutral-500/50 group-hover:bg-blue-500 transition-colors mx-auto" />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-2 group cursor-ns-resize"
              onMouseDown={(e) => handleResizeMouseDown(e, 'b')}
            >
              <div className="h-0.5 w-full bg-neutral-500/50 group-hover:bg-blue-500 transition-colors my-auto" />
            </div>
            <div
              className="absolute bottom-0 right-0 w-4 h-4 group cursor-nwse-resize"
              onMouseDown={(e) => handleResizeMouseDown(e, 'br')}
            >
              <div
                className="w-full h-full"
                style={{
                  background:
                    'linear-gradient(135deg, transparent 0%, transparent 50%, #6b7280 50%, #6b7280 75%, transparent 75%, transparent 100%)',
                }}
              />
            </div>
        </div>
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 pl-4 overflow-y-auto max-h-[70vh]">
            <div className="bg-neutral-800/60 rounded-lg p-3 border border-neutral-700/80">
                <h3 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2"><ImageIcon />글로벌 참조 (콘티)</h3>
                {!globalReference ? (
                    <button type="button" onClick={() => globalRefFileInputRef.current?.click()} className="w-full text-center p-4 border-2 border-dashed border-neutral-600 hover:border-neutral-500 rounded-md text-sm text-neutral-400">
                        <UploadIcon className="mx-auto w-6 h-6 mb-1"/>
                        콘티 이미지 업로드
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className="relative group aspect-video">
                            <img src={globalReference.dataUrl} alt="Global Reference" className="w-full h-full object-contain rounded-md" />
                            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button type="button" onClick={() => setIsContiEditorOpen(true)} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-blue-500" title="편집"><EditIcon width="14" height="14" /></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={toggleGlobalRefVisibility} className="p-1.5 text-neutral-300 hover:text-white" title={globalReference.isVisible ? '숨기기' : '보이기'}>
                                {globalReference.isVisible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <OpacityIcon className="text-neutral-400" />
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={globalReference.opacity}
                                onChange={e => handleGlobalRefOpacityChange(Number(e.target.value))}
                                className="w-full h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>
             {editBase && (
                <div className="bg-neutral-800/60 rounded-lg p-3 border border-neutral-700/80">
                    <h3 className="text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2"><EditIcon />수정 콘티</h3>
                    <div className="space-y-3">
                        <div className="relative group aspect-video">
                            <img src={editBase.dataUrl} alt="Edit Base" className="w-full h-full object-contain rounded-md" />
                            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button type="button" onClick={() => setEditingReference({ type: 'editBase', dataUrl: editBase.dataUrl })} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-blue-500" title="편집"><EditIcon width="14" height="14" /></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={toggleEditBaseVisibility} className="p-1.5 text-neutral-300 hover:text-white" title={editBase.isVisible ? '숨기기' : '보이기'}>
                                {editBase.isVisible ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <OpacityIcon className="text-neutral-400" />
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={editBase.opacity}
                                onChange={e => handleEditBaseOpacityChange(Number(e.target.value))}
                                className="w-full h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-neutral-800/60 rounded-lg p-3 border border-neutral-700/80">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2"><LayersIcon />레이어</h3>
                    <button type="button" onClick={addSketchLayer} className="p-1.5 text-neutral-300 hover:text-white" title="새 레이어 추가"><PlusIcon /></button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {layers.slice().reverse().map((layer, reverseIndex) => {
                        const originalIndex = layers.length - 1 - reverseIndex;
                        const canvas = canvasRefs.current[layer.id];
                        const dataUrl = canvas?.toDataURL() ?? '';
                        return (
                        <div key={layer.id} className={`p-2 rounded-md transition-colors duration-200 ${activeLayerId === layer.id ? 'bg-blue-600/30' : 'bg-neutral-700/70 hover:bg-neutral-600/70'}`}>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setActiveLayerId(layer.id)} className="flex-grow flex items-center gap-2 text-left">
                                    <div className="w-10 h-10 rounded border border-neutral-500 bg-neutral-800 flex-shrink-0">
                                        {canvas && (
                                            <img
                                                src={dataUrl}
                                                alt={`${layer.name} thumbnail`}
                                                className="w-full h-full object-contain"
                                                style={{ imageRendering: 'pixelated' }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        {editingLayerId === layer.id ? (
                                            <input
                                                type="text"
                                                defaultValue={layer.name}
                                                autoFocus
                                                onBlur={(e) => handleLayerNameChange(layer.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleLayerNameChange(layer.id, e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingLayerId(null);
                                                }}
                                                onClick={e => e.stopPropagation()}
                                                className="text-sm bg-neutral-800 text-white rounded p-0.5 w-full outline-none"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium truncate" onDoubleClick={() => setEditingLayerId(layer.id)} title="더블클릭하여 이름 편집">
                                                {layer.name}
                                            </p>
                                        )}
                                        <p className="text-xs text-neutral-400 capitalize">{layer.blendMode.replace('-', ' ')} - {Math.round(layer.opacity * 100)}%</p>
                                    </div>
                                </button>
                                <div className="flex flex-col items-center">
                                    <button type="button" onClick={() => moveLayer(layer.id, 'up')} disabled={originalIndex === layers.length - 1} className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"><ArrowUpIcon /></button>
                                    <button type="button" onClick={() => moveLayer(layer.id, 'down')} disabled={originalIndex === 0} className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"><ArrowDownIcon /></button>
                                </div>
                                <div className="flex flex-col items-center">
                                    <button type="button" onClick={() => toggleVisibility(layer.id)} className="p-1.5 text-neutral-300 hover:text-white" title={layer.isVisible ? '레이어 숨기기' : '레이어 보이기'}>
                                        {layer.isVisible ? <EyeIcon /> : <EyeOffIcon />}
                                    </button>
                                </div>
                            </div>
                            
                            {activeLayerId === layer.id && (
                                <div className="mt-2 space-y-3">
                                     <div className="flex items-center gap-2 text-sm text-neutral-300">
                                        <OpacityIcon />
                                        <input
                                            type="range"
                                            min="0" max="1" step="0.05"
                                            value={layer.opacity}
                                            onChange={e => handleOpacityChange(layer.id, parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                    <select
                                        value={layer.blendMode}
                                        onChange={e => handleBlendModeChange(layer.id, e.target.value as GlobalCompositeOperation)}
                                        className="w-full p-1.5 text-xs bg-neutral-700 border border-neutral-600 rounded-md"
                                    >
                                        {BLEND_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                                    </select>
                                    
                                    <div className="border-t border-neutral-600/70 pt-3 mt-3">
                                        <h4 className="text-xs font-semibold text-neutral-400 mb-2">설정 이미지</h4>
                                        <div className="grid grid-cols-4 gap-1">
                                            {layer.setteiImages?.map((img, i) => (
                                                <div key={img.dataUrl} className="relative group aspect-square">
                                                    <img src={img.dataUrl} alt="Settei" className="w-full h-full object-cover rounded-sm" />
                                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1">
                                                      <button onClick={() => setEditingSettei({ layerId: layer.id, imageIndex: i, imageUrl: img.dataUrl, maskUrl: img.maskDataUrl })} className="text-xs text-white bg-blue-600/80 hover:bg-blue-500 px-2 py-1 rounded flex items-center gap-1">
                                                        <PencilIcon width="12" height="12"/> Mask
                                                      </button>
                                                    </div>
                                                    <button onClick={() => removeSetteiImage(layer.id, img.dataUrl)} className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500"><CloseIcon width="10" height="10"/></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => triggerCharacterSetteiUpload(layer.id)} className="aspect-square flex items-center justify-center border-2 border-dashed border-neutral-600 rounded-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-400">
                                                <PlusIcon width="14" height="14" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <button type="button" onClick={() => mergeLayerDown(layer.id)} disabled={originalIndex === 0} className="w-full flex items-center justify-center gap-2 text-xs p-1 bg-neutral-600 hover:bg-neutral-500 rounded disabled:opacity-50" title="아래 레이어와 병합">
                                            <MergeDownIcon />
                                        </button>
                                        <button type="button" onClick={() => deleteLayer(layer.id)} disabled={layers.length <= 1} className="w-full flex items-center justify-center gap-2 text-xs p-1 bg-red-800 hover:bg-red-700 rounded disabled:opacity-50" title="레이어 삭제">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>
            </div>
        </div>
      </div>
      <input
        ref={setteiFileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleSetteiUpload}
        className="hidden"
      />
      <input
        ref={globalRefFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleGlobalRefUpload}
        className="hidden"
      />
      {editingReference && (
        <ReferenceImageEditorModal
          isOpen={!!editingReference}
          dataUrl={editingReference.dataUrl}
          onSave={handleSaveReferenceEdit}
          onClose={() => setEditingReference(null)}
        />
      )}
      {isContiEditorOpen && globalReference && (
        <ContiEditorModal
          isOpen={isContiEditorOpen}
          imageUrl={globalReference.dataUrl}
          onSave={handleSaveContiEdit}
          onClose={() => setIsContiEditorOpen(false)}
        />
      )}
       {editingSettei && (
        <SetteiEditorModal
          isOpen={!!editingSettei}
          imageUrl={editingSettei.imageUrl}
          initialMaskUrl={editingSettei.maskUrl}
          onClose={() => setEditingSettei(null)}
          onSave={handleSetteiMaskSave}
        />
      )}
    </div>
  );
};
