
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AngleIcon,
  CircleIcon,
  CloseIcon,
  CropIcon,
  CurveIcon,
  EllipseIcon,
  EraserIcon,
  ExpandIcon,
  LineIcon,
  MarkerIcon,
  OpacityIcon,
  PenIcon,
  PencilIcon,
  RectangleIcon,
  RedoIcon,
  ResetIcon,
  RotateCcwIcon,
  RotateCwIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './Icons';

type Point = { x: number; y: number };

interface ContiEditorModalProps {
  isOpen: boolean;
  imageUrl: string;
  onSave: (newDataUrl: string) => void;
  onClose: () => void;
}

type Tool = 'pen' | 'marker' | 'eraser' | 'line' | 'curve' | 'ellipse' | 'mask_pen' | 'crop';

const MAX_ZOOM = 8;
const MIN_ZOOM = 0.2;
const ZOOM_STEP = 1.2;
const MAX_HISTORY_STATES = 50;

const MASK_COLOR_MAP: Record<string, string> = {
  red: '255, 0, 0',
  green: '0, 255, 0',
  blue: '0, 0, 255',
};

const drawPath = (ctx: CanvasRenderingContext2D, points: Point[]) => {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length < 3) {
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  } else {
    let i = 1;
    for (; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.quadraticCurveTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  ctx.stroke();
};

const drawVariableWidthPath = (ctx: CanvasRenderingContext2D, points: Point[], baseSize: number, sensitivity: number) => {
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

const drawMarkerPath = (ctx: CanvasRenderingContext2D, points: Point[], color: string, size: number, opacity: number, shape: 'rectangle' | 'circle', rotation: number) => {
    if (points.length === 0) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    
    const angleInRadians = rotation * (Math.PI / 180);

    const stamp = (x: number, y: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angleInRadians);
        ctx.beginPath();
        if (shape === 'rectangle') {
            const width = size / 3; const height = size;
            ctx.rect(-width / 2, -height / 2, width, height);
        } else {
            ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
        }
        ctx.fill();
        ctx.restore();
    };

    let lastPoint = points[0];
    stamp(lastPoint.x, lastPoint.y);
    for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i];
        const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
        const angle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);
        const step = Math.min(size / 4, 3); // Refined step for smoother strokes
        for (let d = step; d < dist; d += step) {
            const x = lastPoint.x + Math.cos(angle) * d;
            const y = lastPoint.y + Math.sin(angle) * d;
            stamp(x, y);
        }
        stamp(currentPoint.x, currentPoint.y);
        lastPoint = currentPoint;
    }
    ctx.globalAlpha = 1.0;
};

const drawEllipse = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    const centerX = Math.min(start.x, end.x) + radiusX;
    const centerY = Math.min(start.y, end.y) + radiusY;
    if (radiusX > 0 && radiusY > 0) {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
    }
};

const ColorPicker: React.FC<{
  color: string;
  onChange: (color: string) => void;
}> = ({ color, onChange }) => {
  return (
    <div className="relative w-8 h-8">
      <div 
        className="w-full h-full rounded-md border border-neutral-500" 
        style={{ backgroundColor: color }}
      />
      <input
        type="color"
        value={color}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="색상 선택"
        title="색상 선택"
      />
    </div>
  );
};

export const ContiEditorModal: React.FC<ContiEditorModalProps> = ({ isOpen, imageUrl, onSave, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewLineCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const pointsRef = useRef<Point[]>([]);
  const isDrawing = useRef(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState<string>('#000000');
  const [penSize, setPenSize] = useState<number>(3);
  const [penSensitivity, setPenSensitivity] = useState<number>(0.4);
  const [eraserSize, setEraserSize] = useState<number>(25);
  const [markerColor, setMarkerColor] = useState<string>('#404040');
  const [markerSize, setMarkerSize] = useState<number>(20);
  const [markerOpacity, setMarkerOpacity] = useState<number>(0.2);
  const [markerShape, setMarkerShape] = useState<'rectangle' | 'circle'>('rectangle');
  const [markerRotation, setMarkerRotation] = useState<number>(0);
  const [maskPenColor, setMaskPenColor] = useState<'red' | 'green' | 'blue'>('red');
  const [maskPenSize, setMaskPenSize] = useState<number>(30);
  const [maskPenOpacity, setMaskPenOpacity] = useState<number>(0.5);
  
  const [lineStartPoint, setLineStartPoint] = useState<Point | null>(null);
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  const [ellipseStartPoint, setEllipseStartPoint] = useState<Point | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const cropStartPointRef = useRef<Point | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isScrubbyZooming, setIsScrubbyZooming] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  
  const [history, setHistory] = useState<{ stack: ImageData[], index: number }>({ stack: [], index: -1 });
  
  const [canvasSize, setCanvasSize] = useState({ width: 100, height: 100 });
  const [baseImageOpacity, setBaseImageOpacity] = useState(1);
  
  const canUndo = history.index > 0;
  const canRedo = history.index < history.stack.length - 1;

  const saveState = useCallback(() => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    const ctx = drawingCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    setHistory(prev => {
        const newStack = prev.stack.slice(0, prev.index + 1);
        newStack.push(imageData);
        if (newStack.length > MAX_HISTORY_STATES) newStack.shift();
        return { stack: newStack, index: newStack.length - 1 };
    });
  }, []);
  
  const restoreState = useCallback((index: number) => {
      const drawingCanvas = drawingCanvasRef.current;
      if (!drawingCanvas || !history.stack[index]) return;
      const ctx = drawingCanvas.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(history.stack[index], 0, 0);
  }, [history.stack]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const newIndex = history.index - 1;
      setHistory(prev => ({...prev, index: newIndex }));
      restoreState(newIndex);
    }
  }, [canUndo, history.index, restoreState]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const newIndex = history.index + 1;
      setHistory(prev => ({...prev, index: newIndex }));
      restoreState(newIndex);
    }
  }, [canRedo, history.index, restoreState]);
  
  const resetView = useCallback(() => { setZoom(1); setPan({x:0, y:0}); setRotation(0); }, []);
  
  const loadImage = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const size = { width: img.naturalWidth, height: img.naturalHeight };
        setCanvasSize(size);
        
        const canvases = [baseCanvasRef.current, drawingCanvasRef.current, previewLineCanvasRef.current];
        canvases.forEach(c => {
            if (c) {
                c.width = size.width;
                c.height = size.height;
            }
        });

        const baseCtx = baseCanvasRef.current?.getContext('2d');
        if (baseCtx) {
            baseCtx.drawImage(img, 0, 0);
        }
        
        const drawingCtx = drawingCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        if(drawingCtx && drawingCanvasRef.current) {
            drawingCtx.clearRect(0,0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
            const initialImageData = drawingCtx.getImageData(0,0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
            setHistory({ stack: [initialImageData], index: 0 });
        }
        
        resetView();
        setTool('pen');
    };
    img.src = url;
  }, [resetView]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const newImageUrl = event.target?.result as string;
            if (newImageUrl) {
                loadImage(newImageUrl);
            }
        };
        reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };


  useEffect(() => {
    if (isOpen) {
        loadImage(imageUrl);
        setBaseImageOpacity(1);
    }
  }, [isOpen, imageUrl, loadImage]);

  const getCoords = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const mouseX = (clientX - rect.left - pan.x) / zoom;
      const mouseY = (clientY - rect.top - pan.y) / zoom;
      const rad = -rotation * (Math.PI / 180);
      const cos = Math.cos(rad); const sin = Math.sin(rad);
      const cx = canvasSize.width / 2; const cy = canvasSize.height / 2;
      const translatedX = mouseX - cx; const translatedY = mouseY - cy;
      const unrotatedX = translatedX * cos - translatedY * sin;
      const unrotatedY = translatedX * sin + translatedY * cos;
      return { x: unrotatedX + cx, y: unrotatedY + cy };
  }, [zoom, pan, rotation, canvasSize]);

  const clearPreview = useCallback(() => {
    const previewCtx = previewLineCanvasRef.current?.getContext('2d');
    if (previewCtx && previewLineCanvasRef.current) {
        previewCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
    }
  }, []);

  const handleApplyCrop = useCallback(() => {
    if (!cropRect) return;

    saveState();

    const { x, y, width, height } = cropRect;
    
    if (width < 1 || height < 1) {
        setCropRect(null);
        clearPreview();
        return;
    }
    
    const baseC = baseCanvasRef.current;
    const drawingC = drawingCanvasRef.current;

    const tempBaseCanvas = document.createElement('canvas');
    tempBaseCanvas.width = width;
    tempBaseCanvas.height = height;
    const tempBaseCtx = tempBaseCanvas.getContext('2d');
    if (baseC) tempBaseCtx?.drawImage(baseC, x, y, width, height, 0, 0, width, height);
    
    const tempDrawingCanvas = document.createElement('canvas');
    tempDrawingCanvas.width = width;
    tempDrawingCanvas.height = height;
    const tempDrawingCtx = tempDrawingCanvas.getContext('2d');
    if (drawingC) tempDrawingCtx?.drawImage(drawingC, x, y, width, height, 0, 0, width, height);

    const newSize = { width: Math.round(width), height: Math.round(height) };
    setCanvasSize(newSize);

    const canvasesToUpdate = [baseCanvasRef.current, drawingCanvasRef.current, previewLineCanvasRef.current];
    canvasesToUpdate.forEach(c => {
        if (c) {
            c.width = newSize.width;
            c.height = newSize.height;
        }
    });

    const baseCtx = baseC?.getContext('2d');
    if (baseCtx) {
        baseCtx.clearRect(0, 0, newSize.width, newSize.height);
        baseCtx.drawImage(tempBaseCanvas, 0, 0);
    }
    
    const drawingCtx = drawingC?.getContext('2d');
    if (drawingCtx) {
        drawingCtx.clearRect(0, 0, newSize.width, newSize.height);
        drawingCtx.drawImage(tempDrawingCanvas, 0, 0);
    }

    resetView();
    setCropRect(null);
    clearPreview();
    setTool('pen');

    setTimeout(() => {
        saveState();
    }, 100);
  }, [cropRect, saveState, resetView, clearPreview]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (isScrubbyZooming) {
        const dx = e.clientX - panStartRef.current.x;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        const zoomFactor = Math.pow(1.01, dx);
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        setZoom(prevZoom => {
            const newZoom = prevZoom * zoomFactor;
            const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            if (clampedZoom === prevZoom) return prevZoom;

            setPan(prevPan => {
                const pointOnCanvas = { x: (mousePos.x - prevPan.x) / prevZoom, y: (mousePos.y - prevPan.y) / prevZoom };
                return { x: mousePos.x - pointOnCanvas.x * clampedZoom, y: mousePos.y - pointOnCanvas.y * clampedZoom };
            });
            return clampedZoom;
        });
        return;
      }
      if (isPanning) {
          const dx = e.clientX - panStartRef.current.x; const dy = e.clientY - panStartRef.current.y;
          panStartRef.current = { x: e.clientX, y: e.clientY };
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          return;
      }
      
      const coords = getCoords(e);
      if (!coords) return;

      if (tool === 'crop' && cropStartPointRef.current) {
        const previewCtx = previewLineCanvasRef.current?.getContext('2d');
        if (!previewCtx || !previewLineCanvasRef.current) return;
        previewCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);
    
        const start = cropStartPointRef.current;
        const end = coords;
    
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(start.x - end.x);
        const height = Math.abs(start.y - end.y);
    
        previewCtx.save();
        previewCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        previewCtx.fillRect(0, 0, previewCtx.canvas.width, previewCtx.canvas.height);
        previewCtx.clearRect(x, y, width, height);
        previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        previewCtx.lineWidth = 1 / zoom;
        previewCtx.setLineDash([4 / zoom, 2 / zoom]);
        previewCtx.strokeRect(x, y, width, height);
        previewCtx.restore();
        return;
      }

      const previewCtx = previewLineCanvasRef.current?.getContext('2d');
      if (!previewCtx || !previewLineCanvasRef.current) return;
      previewCtx.clearRect(0, 0, previewLineCanvasRef.current.width, previewLineCanvasRef.current.height);

      if (isDrawing.current) {
          pointsRef.current.push(coords);
          if (tool === 'pen') {
              previewCtx.strokeStyle = penColor;
              drawVariableWidthPath(previewCtx, pointsRef.current, penSize, penSensitivity);
          } else if (tool === 'marker') {
              drawMarkerPath(previewCtx, pointsRef.current, markerColor, markerSize, markerOpacity, markerShape, markerRotation);
          } else if (tool === 'eraser') {
              previewCtx.strokeStyle = '#000';
              previewCtx.lineWidth = eraserSize;
              previewCtx.lineCap = 'round';
              previewCtx.lineJoin = 'round';
              drawPath(previewCtx, pointsRef.current);
          } else if (tool === 'mask_pen') {
              previewCtx.strokeStyle = `rgba(${MASK_COLOR_MAP[maskPenColor]}, ${maskPenOpacity})`;
              previewCtx.lineWidth = maskPenSize;
              previewCtx.lineCap = 'round';
              previewCtx.lineJoin = 'round';
              drawPath(previewCtx, pointsRef.current);
          }
      } else if (tool === 'line' && lineStartPoint) {
          previewCtx.strokeStyle = penColor;
          previewCtx.lineWidth = penSize;
          previewCtx.lineCap = 'round';
          previewCtx.beginPath(); previewCtx.moveTo(lineStartPoint.x, lineStartPoint.y); previewCtx.lineTo(coords.x, coords.y); previewCtx.stroke();
      } else if (tool === 'ellipse' && ellipseStartPoint) {
          previewCtx.strokeStyle = penColor;
          previewCtx.lineWidth = penSize;
          drawEllipse(previewCtx, ellipseStartPoint, coords);
      } else if (tool === 'curve') {
        const drawPointIndicator = (p: Point) => {
            previewCtx.save();
            previewCtx.fillStyle = '#fff'; previewCtx.strokeStyle = '#3b82f6';
            previewCtx.lineWidth = 1.5 / zoom;
            previewCtx.beginPath(); previewCtx.arc(p.x, p.y, 4 / zoom, 0, 2 * Math.PI);
            previewCtx.fill(); previewCtx.stroke();
            previewCtx.restore();
        };

        curvePoints.forEach(p => drawPointIndicator(p));

        if (curvePoints.length === 1) { // P1 is set. Preview line to cursor for P2.
            previewCtx.strokeStyle = penColor; previewCtx.lineWidth = penSize; previewCtx.lineCap = 'round';
            previewCtx.beginPath(); previewCtx.moveTo(curvePoints[0].x, curvePoints[0].y); previewCtx.lineTo(coords.x, coords.y); previewCtx.stroke();
        } else if (curvePoints.length === 2) { // P1, P2 are set. Previewing with CP1.
            const [p1, p2] = curvePoints;
            const cp1 = coords;
            
            // Draw helper lines to the first control point
            previewCtx.save();
            previewCtx.strokeStyle = '#a0a0a0'; previewCtx.lineWidth = 1 / zoom;
            previewCtx.setLineDash([2 / zoom, 4 / zoom]);
            previewCtx.beginPath(); previewCtx.moveTo(p1.x, p1.y); previewCtx.lineTo(cp1.x, cp1.y); previewCtx.stroke();
            previewCtx.beginPath(); previewCtx.moveTo(p2.x, p2.y); previewCtx.lineTo(cp1.x, cp1.y); previewCtx.stroke();
            previewCtx.restore();

            // Preview a quadratic curve to give immediate feedback
            previewCtx.strokeStyle = penColor; previewCtx.lineWidth = penSize;
            previewCtx.beginPath();
            previewCtx.moveTo(p1.x, p1.y);
            previewCtx.quadraticCurveTo(cp1.x, cp1.y, p2.x, p2.y);
            previewCtx.stroke();
        } else if (curvePoints.length === 3) { // Have P1, P2, CP1. Cursor is CP2. Preview cubic curve.
            const [p1, p2, cp1] = curvePoints;
            const cp2 = coords;

            previewCtx.save(); // Draw helper lines from endpoints to control points
            previewCtx.strokeStyle = '#a0a0a0'; previewCtx.lineWidth = 1 / zoom;
            previewCtx.setLineDash([2 / zoom, 4 / zoom]);
            previewCtx.beginPath(); previewCtx.moveTo(p1.x, p1.y); previewCtx.lineTo(cp1.x, cp1.y); previewCtx.stroke();
            previewCtx.beginPath(); previewCtx.moveTo(p2.x, p2.y); previewCtx.lineTo(cp2.x, cp2.y); previewCtx.stroke();
            previewCtx.restore();

            previewCtx.strokeStyle = penColor; previewCtx.lineWidth = penSize; previewCtx.lineCap = 'round'; // Draw curve
            previewCtx.beginPath(); previewCtx.moveTo(p1.x, p1.y); previewCtx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y); previewCtx.stroke();
        }
      }
  }, [getCoords, tool, penColor, penSize, penSensitivity, eraserSize, markerColor, markerSize, markerOpacity, markerShape, markerRotation, lineStartPoint, curvePoints, ellipseStartPoint, isPanning, zoom, isScrubbyZooming, maskPenColor, maskPenOpacity, maskPenSize]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
      if (e.altKey && e.button === 2) {
          e.preventDefault();
          setIsScrubbyZooming(true);
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
      }
      if (isSpacePressed || e.button === 1) {
          setIsPanning(true);
          panStartRef.current = { x: e.clientX, y: e.clientY };
          return;
      }
      if (e.button !== 0) return;

      const coords = getCoords(e);
      if (!coords) return;
      
      if (tool === 'crop') {
        cropStartPointRef.current = coords;
        setCropRect(null);
        return;
      }

      const isBrushTool = tool === 'pen' || tool === 'marker' || tool === 'eraser' || tool === 'mask_pen';
      if (isBrushTool) {
          saveState();
          isDrawing.current = true;
          pointsRef.current = [coords];
      } else if (tool === 'line') {
          if (!lineStartPoint) {
              saveState();
              setLineStartPoint(coords);
          } else {
              const drawingCtx = drawingCanvasRef.current?.getContext('2d');
              if (drawingCtx) {
                  drawingCtx.strokeStyle = penColor; drawingCtx.lineWidth = penSize; drawingCtx.lineCap = 'round';
                  drawingCtx.beginPath(); drawingCtx.moveTo(lineStartPoint.x, lineStartPoint.y); drawingCtx.lineTo(coords.x, coords.y); drawingCtx.stroke();
              }
              setLineStartPoint(null);
          }
      } else if (tool === 'ellipse') {
          saveState();
          setEllipseStartPoint(coords);
      } else if (tool === 'curve') {
          saveState();
          if (curvePoints.length < 3) { // Collect p1, p2, cp1
              setCurvePoints(prev => [...prev, coords]);
          } else { // on 4th click for cp2, draw the curve
              const [p1, p2, cp1] = curvePoints;
              const cp2 = coords;
              const drawingCtx = drawingCanvasRef.current?.getContext('2d');
              if (drawingCtx) {
                  drawingCtx.strokeStyle = penColor;
                  drawingCtx.lineWidth = penSize;
                  drawingCtx.lineCap = 'round';
                  drawingCtx.beginPath();
                  drawingCtx.moveTo(p1.x, p1.y);
                  drawingCtx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
                  drawingCtx.stroke();
              }
              setCurvePoints([]);
              const previewCtx = previewLineCanvasRef.current?.getContext('2d');
              previewCtx?.clearRect(0,0, previewCtx.canvas.width, previewCtx.canvas.height);
          }
      }
  }, [tool, getCoords, saveState, lineStartPoint, curvePoints, penColor, penSize, isSpacePressed]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
      if (isScrubbyZooming) {
          setIsScrubbyZooming(false);
          return;
      }
      setIsPanning(false);

      if (tool === 'crop' && cropStartPointRef.current) {
        const start = cropStartPointRef.current;
        const end = getCoords(e);
        cropStartPointRef.current = null;
        
        if (end) {
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const width = Math.abs(start.x - end.x);
            const height = Math.abs(start.y - end.y);
            if (width > 1 && height > 1) {
                setCropRect({ x, y, width, height });
            }
        }
        
        // Don't clear preview, keep the rect visible
        return;
      }

      if (!isDrawing.current && tool !== 'ellipse') return;

      const coords = getCoords(e);
      if (!coords) {
          isDrawing.current = false;
          return;
      };
      
      const isBrushTool = tool === 'pen' || tool === 'marker' || tool === 'eraser' || tool === 'mask_pen';
      if (isBrushTool && isDrawing.current) {
          const drawingCtx = drawingCanvasRef.current?.getContext('2d');
          if (drawingCtx) {
              if (tool === 'pen') {
                  drawingCtx.strokeStyle = penColor;
                  drawVariableWidthPath(drawingCtx, pointsRef.current, penSize, penSensitivity);
              } else if (tool === 'marker') {
                  drawMarkerPath(drawingCtx, pointsRef.current, markerColor, markerSize, markerOpacity, markerShape, markerRotation);
              } else if (tool === 'mask_pen') {
                  drawingCtx.strokeStyle = `rgba(${MASK_COLOR_MAP[maskPenColor]}, ${maskPenOpacity})`;
                  drawingCtx.lineWidth = maskPenSize;
                  drawingCtx.lineCap = 'round';
                  drawingCtx.lineJoin = 'round';
                  drawPath(drawingCtx, pointsRef.current);
              } else { // eraser
                  drawingCtx.globalCompositeOperation = 'destination-out';
                  drawingCtx.lineWidth = eraserSize; drawingCtx.lineCap = 'round'; drawingCtx.lineJoin = 'round';
                  drawPath(drawingCtx, pointsRef.current);
                  drawingCtx.globalCompositeOperation = 'source-over';
              }
          }
      } else if (tool === 'ellipse' && ellipseStartPoint) {
          const drawingCtx = drawingCanvasRef.current?.getContext('2d');
          if(drawingCtx) {
              drawingCtx.strokeStyle = penColor; drawingCtx.lineWidth = penSize;
              drawEllipse(drawingCtx, ellipseStartPoint, coords);
          }
          setEllipseStartPoint(null);
      }
      
      clearPreview();
      isDrawing.current = false;
      pointsRef.current = [];
  }, [tool, getCoords, ellipseStartPoint, penColor, penSize, penSensitivity, eraserSize, markerColor, markerSize, markerOpacity, markerShape, markerRotation, isScrubbyZooming, maskPenColor, maskPenOpacity, maskPenSize, clearPreview]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const newZoom = e.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const rect = containerRef.current!.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setPan(prevPan => {
          const pointOnCanvas = { x: (anchor.x - prevPan.x) / zoom, y: (anchor.y - prevPan.y) / zoom };
          return { x: anchor.x - pointOnCanvas.x * clampedZoom, y: anchor.y - pointOnCanvas.y * clampedZoom };
      });
      setZoom(clampedZoom);
  }, [zoom]);

  const handleSave = () => {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvasSize.width;
    finalCanvas.height = canvasSize.height;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx || !baseCanvasRef.current || !drawingCanvasRef.current) return;
    
    if (baseImageOpacity === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    } else {
        ctx.globalAlpha = baseImageOpacity;
        ctx.drawImage(baseCanvasRef.current, 0, 0);
        ctx.globalAlpha = 1;
    }
    
    ctx.drawImage(drawingCanvasRef.current, 0, 0);
    onSave(finalCanvas.toDataURL('image/png'));
  };

  const handleClearCanvas = useCallback(() => {
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    saveState();
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    saveState();
  }, [saveState]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const anchor = { x: rect.width / 2, y: rect.height / 2 };

    setZoom(prevZoom => {
        const newZoom = direction === 'in' ? prevZoom * ZOOM_STEP : prevZoom / ZOOM_STEP;
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        setPan(prevPan => {
            const pointOnCanvas = { x: (anchor.x - prevPan.x) / prevZoom, y: (anchor.y - prevPan.y) / prevZoom };
            return { x: anchor.x - pointOnCanvas.x * clampedZoom, y: anchor.y - pointOnCanvas.y * clampedZoom };
        });
        return clampedZoom;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.isContentEditable) return;
      
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsSpacePressed(true); }
      if (e.key === 'Escape') { 
        if (tool === 'crop') {
            setCropRect(null);
            cropStartPointRef.current = null;
            clearPreview();
        }
        setLineStartPoint(null); setCurvePoints([]); setEllipseStartPoint(null); 
      }
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); setTool('pen'); }
      if (e.key.toLowerCase() === 'm') { e.preventDefault(); setTool('marker'); }
      if (e.key.toLowerCase() === 'e') { e.preventDefault(); setTool('eraser'); }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                e.shiftKey ? handleRedo() : handleUndo();
                break;
            case 'y':
                e.preventDefault();
                handleRedo();
                break;
            case '=':
            case '+':
                e.preventDefault();
                handleZoom('in');
                break;
            case '-':
                e.preventDefault();
                handleZoom('out');
                break;
            case '0':
                e.preventDefault();
                resetView();
                break;
        }
      }

      if (e.key === ']' || e.key === '[') {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          const direction = e.key === ']' ? 1 : -1;
          const change = step * direction;

          switch (tool) {
              case 'pen':
              case 'line':
              case 'curve':
              case 'ellipse':
                  setPenSize(s => Math.max(1, Math.min(100, s + change)));
                  break;
              case 'marker':
                  setMarkerSize(s => Math.max(1, Math.min(200, s + change)));
                  break;
              case 'mask_pen':
                  setMaskPenSize(s => Math.max(1, Math.min(200, s + change)));
                  break;
              case 'eraser':
                  setEraserSize(s => Math.max(1, Math.min(200, s + change)));
                  break;
          }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') { e.preventDefault(); setIsSpacePressed(false); }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, handleUndo, handleRedo, tool, handleZoom, resetView, clearPreview]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleNativeEvent = (e: MouseEvent) => handleMouseMove(e);
    const handleMouseDownEvent = (e: MouseEvent) => handleMouseDown(e);
    
    container.addEventListener('mousemove', handleNativeEvent);
    container.addEventListener('mousedown', handleMouseDownEvent);
    
    const handleMouseUpOnWindow = (e: MouseEvent) => {
      if (isDrawing.current || isPanning || isScrubbyZooming || cropStartPointRef.current) {
        handleMouseUp(e);
      }
    };

    window.addEventListener('mouseup', handleMouseUpOnWindow);

    return () => {
        container.removeEventListener('mousemove', handleNativeEvent);
        container.removeEventListener('mousedown', handleMouseDownEvent);
        window.removeEventListener('mouseup', handleMouseUpOnWindow);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp, isDrawing, isPanning, isScrubbyZooming]);

  useEffect(() => {
    clearPreview();
    setCropRect(null);
  }, [tool, clearPreview]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-[#363636] rounded-xl shadow-2xl w-full h-full flex flex-col border border-neutral-700/50" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-neutral-700/80 flex-shrink-0">
          <h2 className="text-xl font-semibold text-neutral-100">콘티 편집기</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:bg-neutral-600 rounded-full"><CloseIcon /></button>
        </div>
        
        {/* Main Content */}
        <div className="flex-grow flex overflow-hidden">
          {/* Toolbar */}
          <div className="w-64 bg-[#2f2f2f] p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0 border-r border-neutral-700/80">
            <div>
              <h3 className="text-sm font-semibold mb-2 text-neutral-300">도구</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setTool('pen')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'pen' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><PenIcon/><span className="text-xs mt-1">펜</span></button>
                <button onClick={() => setTool('marker')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'marker' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><MarkerIcon/><span className="text-xs mt-1">마커</span></button>
                <button onClick={() => setTool('eraser')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'eraser' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><EraserIcon/><span className="text-xs mt-1">지우개</span></button>
                <button onClick={() => setTool('line')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'line' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><LineIcon/><span className="text-xs mt-1">선</span></button>
                <button onClick={() => setTool('curve')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'curve' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><CurveIcon/><span className="text-xs mt-1">곡선</span></button>
                <button onClick={() => setTool('ellipse')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'ellipse' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><EllipseIcon/><span className="text-xs mt-1">타원</span></button>
                <button onClick={() => setTool('mask_pen')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'mask_pen' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><PencilIcon/><span className="text-xs mt-1">마스크</span></button>
                <button onClick={() => setTool('crop')} className={`p-3 rounded-md flex flex-col items-center ${tool === 'crop' ? 'bg-blue-600' : 'bg-neutral-700 hover:bg-neutral-600'}`}><CropIcon/><span className="text-xs mt-1">자르기</span></button>
              </div>
            </div>
            {(tool === 'pen' || tool === 'line' || tool === 'curve' || tool === 'ellipse') && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-300">펜 설정</h3>
                <div className="flex items-center gap-4"><ColorPicker color={penColor} onChange={setPenColor} /><span className="text-sm">색상</span></div>
                <div className="space-y-1">
                  <label className="text-xs">크기: {penSize}px</label>
                  <input type="range" min="1" max="100" value={penSize} onChange={e => setPenSize(Number(e.target.value))} className="w-full"/>
                </div>
                {tool === 'pen' && <div className="space-y-1">
                  <label className="text-xs">감도: {penSensitivity.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={penSensitivity} onChange={e => setPenSensitivity(Number(e.target.value))} className="w-full"/>
                </div>}
              </div>
            )}
            {tool === 'marker' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-300">마커 설정</h3>
                <div className="flex items-center gap-4"><ColorPicker color={markerColor} onChange={setMarkerColor} /><span className="text-sm">색상</span></div>
                <div className="space-y-1">
                  <label className="text-xs">크기: {markerSize}px</label>
                  <input type="range" min="1" max="200" value={markerSize} onChange={e => setMarkerSize(Number(e.target.value))} className="w-full"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">투명도: {Math.round(markerOpacity*100)}%</label>
                  <input type="range" min="0.01" max="1" step="0.01" value={markerOpacity} onChange={e => setMarkerOpacity(Number(e.target.value))} className="w-full"/>
                </div>
              </div>
            )}
            {tool === 'eraser' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-300">지우개 설정</h3>
                <div className="space-y-1">
                  <label className="text-xs">크기: {eraserSize}px</label>
                  <input type="range" min="1" max="200" value={eraserSize} onChange={e => setEraserSize(Number(e.target.value))} className="w-full"/>
                </div>
              </div>
            )}
            {tool === 'mask_pen' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-300">방향 마스크 설정</h3>
                <div className="flex items-center justify-between gap-2 text-white">
                  <button onClick={() => setMaskPenColor('red')} className={`w-full p-2 text-xs rounded border-2 ${maskPenColor === 'red' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: `rgba(${MASK_COLOR_MAP.red}, 0.7)`}}>정면</button>
                  <button onClick={() => setMaskPenColor('green')} className={`w-full p-2 text-xs rounded border-2 ${maskPenColor === 'green' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: `rgba(${MASK_COLOR_MAP.green}, 0.7)`}}>측면</button>
                  <button onClick={() => setMaskPenColor('blue')} className={`w-full p-2 text-xs rounded border-2 ${maskPenColor === 'blue' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: `rgba(${MASK_COLOR_MAP.blue}, 0.7)`}}>후면</button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">크기: {maskPenSize}px</label>
                  <input type="range" min="1" max="200" value={maskPenSize} onChange={e => setMaskPenSize(Number(e.target.value))} className="w-full"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs">투명도: {Math.round(maskPenOpacity*100)}%</label>
                  <input type="range" min="0.01" max="1" step="0.01" value={maskPenOpacity} onChange={e => setMaskPenOpacity(Number(e.target.value))} className="w-full"/>
                </div>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="w-full flex items-center justify-center gap-2 text-center p-2 border border-red-500/50 hover:border-red-500/80 hover:bg-red-500/20 rounded-md text-sm text-red-400 transition-colors"
                >
                  <TrashIcon width="16" height="16" />
                  마스크 전체 지우기
                </button>
              </div>
            )}
            {tool === 'crop' && (
              <div className="space-y-3 border-t border-neutral-700 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-300">자르기 도구</h3>
                  <p className="text-xs text-neutral-400">캔버스에서 영역을 드래그하여 자를 부분을 선택하세요.</p>
                  {cropRect && (
                      <div className="text-xs font-mono bg-neutral-800 p-2 rounded">
                          <p>X: {Math.round(cropRect.x)}, Y: {Math.round(cropRect.y)}</p>
                          <p>W: {Math.round(cropRect.width)}, H: {Math.round(cropRect.height)}</p>
                      </div>
                  )}
                  <div className="flex gap-2">
                      <button
                          type="button"
                          onClick={handleApplyCrop}
                          disabled={!cropRect}
                          className="w-full text-center p-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm text-white transition-colors disabled:bg-neutral-600 disabled:cursor-not-allowed"
                      >
                          자르기 적용
                      </button>
                      <button
                          type="button"
                          onClick={() => { setCropRect(null); clearPreview(); }}
                          className="w-full text-center p-2 bg-neutral-600 hover:bg-neutral-500 rounded-md text-sm text-neutral-200 transition-colors"
                      >
                          취소
                      </button>
                  </div>
              </div>
            )}
            <div className="border-t border-neutral-700 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-neutral-300">원본 이미지</h3>
                <div className="space-y-1">
                  <label className="text-xs">투명도: {Math.round(baseImageOpacity*100)}%</label>
                  <input type="range" min="0" max="1" step="0.05" value={baseImageOpacity} onChange={e => setBaseImageOpacity(Number(e.target.value))} className="w-full"/>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 text-center p-2 border border-neutral-600 hover:border-neutral-500 rounded-md text-sm text-neutral-300 transition-colors"
                >
                  <UploadIcon width="16" height="16" />
                  이미지 변경...
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  aria-hidden="true"
                />
            </div>
          </div>
          
          {/* Canvas Area */}
          <div 
            ref={containerRef} 
            onWheel={handleWheel} 
            onContextMenu={e => { if (isScrubbyZooming) e.preventDefault() }}
            className="flex-grow relative overflow-hidden" 
            style={{ 
              cursor: isScrubbyZooming ? 'ew-resize' : isSpacePressed ? 'grab' : 'crosshair',
              backgroundColor: '#4f4f4f',
              backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
            }}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
              <div style={{ width: canvasSize.width, height: canvasSize.height, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}>
                  <canvas ref={baseCanvasRef} className="absolute top-0 left-0" style={{ opacity: baseImageOpacity, backgroundColor: baseImageOpacity > 0 ? 'transparent' : 'white' }} />
                  <canvas ref={drawingCanvasRef} className="absolute top-0 left-0" />
                  <canvas ref={previewLineCanvasRef} className="absolute top-0 left-0" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center gap-4 p-4 bg-[#2f2f2f] border-t border-neutral-700/80 rounded-b-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button onClick={handleUndo} disabled={!canUndo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50" title="실행 취소 (Ctrl+Z)"><UndoIcon /></button>
              <button onClick={handleRedo} disabled={!canRedo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50" title="다시 실행 (Ctrl+Y/Shift+Ctrl+Z)"><RedoIcon /></button>
              <button onClick={handleClearCanvas} className="p-2 text-red-400 hover:bg-neutral-600 rounded-md" title="캔버스 지우기"><TrashIcon /></button>
            </div>
            <div className="w-px h-6 bg-neutral-600" />
             <div className="flex items-center gap-1">
                <button onClick={() => handleZoom('out')} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md" title="축소 (Ctrl+-)"><ZoomOutIcon /></button>
                <button onClick={resetView} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md" title="보기 초기화 (Ctrl+0)"><ExpandIcon /></button>
                <button onClick={() => handleZoom('in')} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md" title="확대 (Ctrl+=)"><ZoomInIcon /></button>
             </div>
             <div className="w-px h-6 bg-neutral-600" />
             <div className="flex items-center gap-1">
                <button onClick={() => setRotation(r => r - 15)} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md"><RotateCcwIcon /></button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(rotation)}°</span>
                <button onClick={() => setRotation(r => r + 15)} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md"><RotateCwIcon /></button>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-neutral-600 text-neutral-100 font-medium rounded-md hover:bg-neutral-500">취소</button>
            <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
};
