import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CloseIcon, RedoIcon, UndoIcon, EraserIcon, PencilIcon, TrashIcon } from './Icons';

interface SetteiEditorModalProps {
  isOpen: boolean;
  imageUrl: string;
  initialMaskUrl?: string;
  onSave: (maskDataUrl: string) => void;
  onClose: () => void;
}

type Tool = 'brush' | 'eraser';
type Color = 'red' | 'green' | 'blue';

const COLOR_MAP: Record<Color, string> = {
  red: 'rgb(255, 0, 0)',
  green: 'rgb(0, 255, 0)',
  blue: 'rgb(0, 0, 255)',
};

export const SetteiEditorModal: React.FC<SetteiEditorModalProps> = ({
  isOpen,
  imageUrl,
  initialMaskUrl,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(40);
  const [color, setColor] = useState<Color>('red');
  const [_, forceUpdate] = useState({});

  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

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
    if (historyRef.current.length > 50) {
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

  const handleClearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }, [pushHistory]);

  useEffect(() => {
    if (!isOpen) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (initialMaskUrl) {
            const maskImg = new Image();
            maskImg.crossOrigin = 'anonymous';
            maskImg.onload = () => {
                ctx.drawImage(maskImg, 0, 0);
                historyRef.current = [];
                historyIndexRef.current = -1;
                pushHistory();
            }
            maskImg.src = initialMaskUrl;
        } else {
            historyRef.current = [];
            historyIndexRef.current = -1;
            pushHistory();
        }
      }
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl, initialMaskUrl, pushHistory]);

  const getCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
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
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = COLOR_MAP[color];
    } else { // eraser
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.lineWidth = brushSize;
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
        if (e.shiftKey) handleRedo();
        else handleUndo();
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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-700/80 flex-shrink-0">
          <h2 className="text-xl font-semibold text-neutral-100 flex items-center gap-3">
            <PencilIcon />
            캐릭터 설정 마스크 편집기
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:bg-neutral-600 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div
          className="flex-grow p-4 overflow-hidden relative flex items-center justify-center"
          style={{
            backgroundColor: '#4f4f4f',
            backgroundImage:
              'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          <div className="relative">
            <img src={imageUrl} alt="Settei Base" className="max-w-full max-h-full object-contain select-none pointer-events-none" />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full object-contain cursor-crosshair"
              style={{ opacity: 0.6 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>
        <div className="flex justify-between items-center gap-4 p-4 bg-[#2f2f2f] border-t border-neutral-700/80 rounded-b-xl flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-neutral-700/80 rounded-md p-0.5">
                    <button type="button" onClick={() => setTool('brush')} className={`p-2 rounded-md transition-colors ${tool === 'brush' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} title="Brush"><PencilIcon /></button>
                    <button type="button" onClick={() => setTool('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-600'}`} title="Eraser"><EraserIcon /></button>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setColor('red')} className={`w-8 h-8 rounded-md border-2 ${color === 'red' && tool === 'brush' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: 'rgb(255, 0, 0)'}} title="정면 (Red)" />
              <button type="button" onClick={() => setColor('green')} className={`w-8 h-8 rounded-md border-2 ${color === 'green' && tool === 'brush' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: 'rgb(0, 255, 0)'}} title="측면 (Green)" />
              <button type="button" onClick={() => setColor('blue')} className={`w-8 h-8 rounded-md border-2 ${color === 'blue' && tool === 'brush' ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: 'rgb(0, 0, 255)'}} title="후면 (Blue)" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="200"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-48 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="w-8 text-center font-mono text-sm">{brushSize}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleUndo} disabled={!canUndo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50" title="Undo"><UndoIcon /></button>
              <button onClick={handleRedo} disabled={!canRedo} className="p-2 text-neutral-300 hover:bg-neutral-600 rounded-md disabled:opacity-50" title="Redo"><RedoIcon /></button>
              <button onClick={handleClearCanvas} className="p-2 text-red-400 hover:bg-neutral-600 rounded-md" title="마스크 전체 지우기"><TrashIcon /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-neutral-600 text-neutral-100 font-medium rounded-md hover:bg-neutral-500 transition-colors">
              취소
            </button>
            <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">
              마스크 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};