
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { CameraControls } from './components/CameraControls';
import { GeneratedImage } from './components/GeneratedImage';
import { generateCharacterImage, analyzeScene, simpleChat, translateToEnglish, editImageWithChat } from './services/geminiService';
import type { PoseImage, PerspectiveData, HistoryItem, ChatMessage, CameraOptions } from './types';
import { GithubIcon, MagicWandIcon, CloseIcon, TrashIcon, ResetIcon, DownloadIcon, ZoomInIcon, ZoomOutIcon, ExpandIcon, CompareIcon, UserIcon as UserIconSingle, UsersIcon, SendIcon, LockIcon, UnlockIcon } from './components/Icons';
import { SceneAnalysis } from './components/SceneAnalysis';
import { MasterDashboard } from './components/MasterDashboard'; // Import the new MasterDashboard

interface AppProps {
  userMode: 'master' | 'guest'; // Add userMode prop
  onMasterLogout?: () => void; // Optional logout prop for master mode
}

const LoadingOverlay: React.FC = () => (
  <div 
    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-center p-4" 
    aria-modal="true" 
    role="dialog" 
    aria-labelledby="loading-heading"
  >
    <svg className="animate-spin h-10 w-10 text-neutral-200 mb-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.75V5.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.364 5.63604L16.5858 7.41421" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21.25 12H18.75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.364 18.364L16.5858 16.5858" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      <path d="M12 21.25V18.75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      <path d="M5.63604 18.364L7.41421 16.5858" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2"/>
      <path d="M2.75 12H5.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.1"/>
      <path d="M5.63604 5.63604L7.41421 7.41421" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    </svg>
    <h2 id="loading-heading" className="text-2xl font-semibold text-neutral-100 mb-2">이미지 생성 중...</h2>
    <p className="text-neutral-300 max-w-sm">이 작업은 최대 1분 정도 소요될 수 있습니다. 페이지를 닫거나 새로고침하지 마세요.</p>
  </div>
);

// --- Reset Modal Component ---
interface ResetOptions {
  inputs: boolean;
  canvasAndCamera: boolean;
  renderingStyle: boolean;
  output: boolean;
}

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ResetOptions) => void;
}

const CheckboxItem: React.FC<{ id: string; checked: boolean; onChange: () => void; label: string; description: string; }> = ({ id, checked, onChange, label, description }) => (
  <div onClick={onChange} className="flex items-start p-3 rounded-lg hover:bg-neutral-700/50 cursor-pointer transition-colors">
    <div className="flex items-center h-5 pt-0.5">
      <input
        id={id}
        aria-describedby={`${id}-desc`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        className="form-checkbox cursor-pointer"
      />
    </div>
    <div className="ml-3 text-sm">
      <label htmlFor={id} className="font-medium text-neutral-100 cursor-pointer">{label}</label>
      <p id={`${id}-desc`} className="text-neutral-400">{description}</p>
    </div>
  </div>
);


const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [options, setOptions] = useState<ResetOptions>({
    inputs: true,
    canvasAndCamera: true,
    renderingStyle: true,
    output: true,
  });

  useEffect(() => {
    if (isOpen) {
      setOptions({
        inputs: true,
        canvasAndCamera: true,
        renderingStyle: true,
        output: true,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  const handleOptionChange = (key: keyof ResetOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const allSelected = Object.values(options).every(Boolean);
  const noneSelected = Object.values(options).every(v => !v);

  const handleSelectAll = () => {
    const newValue = !allSelected;
    setOptions({
      inputs: newValue,
      canvasAndCamera: newValue,
      renderingStyle: newValue,
      output: newValue,
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
      aria-modal="true" 
      role="dialog"
    >
      <div 
        className="bg-[#363636] rounded-xl shadow-2xl w-full max-w-lg border border-neutral-700/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-neutral-700/80">
          <h2 className="text-xl font-semibold text-neutral-100 flex items-center gap-3">
            <TrashIcon />
            무엇을 초기화하시겠습니까?
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:bg-neutral-600 rounded-full transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="p-6">
          <p className="text-neutral-400 mb-4">초기화할 항목을 선택하세요. 이 작업은 되돌릴 수 없습니다.</p>
          <div className="space-y-3">
            <CheckboxItem
              id="reset-all"
              checked={allSelected}
              onChange={handleSelectAll}
              label="전체 선택"
              description="모든 항목을 선택하거나 선택 해제합니다."
            />
            <div className="border-t border-neutral-700/80 my-2"></div>
            <CheckboxItem
              id="reset-inputs"
              checked={options.inputs}
              onChange={() => handleOptionChange('inputs')}
              label="입력 이미지 (캐릭터 & 참조)"
              description="업로드된 모든 캐릭터 및 참조 이미지를 제거합니다."
            />
            <CheckboxItem
              id="reset-canvas"
              checked={options.canvasAndCamera}
              onChange={() => handleOptionChange('canvasAndCamera')}
              label="캔버스 및 AI 분석"
              description="모든 스케치, AI 대화, 소실점 설정을 초기화합니다."
            />
            <CheckboxItem
              id="reset-style"
              checked={options.renderingStyle}
              onChange={() => handleOptionChange('renderingStyle')}
              label="렌더링 스타일"
              description="최종 렌더링 스타일 설정을 초기화합니다."
            />
            <CheckboxItem
              id="reset-output"
              checked={options.output}
              onChange={() => handleOptionChange('output')}
              label="생성된 결과"
              description="마지막으로 생성된 이미지, 생성 기록, 오류 메시지를 제거합니다."
            />
          </div>
        </div>
        <div className="flex justify-end items-center gap-3 p-4 bg-[#2f2f2f] border-t border-neutral-700/80 rounded-b-xl">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 bg-neutral-600 text-neutral-100 font-medium rounded-md hover:bg-neutral-500 transition-colors"
          >
            취소
          </button>
          <button 
            type="button"
            onClick={() => onConfirm(options)}
            disabled={noneSelected}
            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-900/50 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <TrashIcon />
            초기화
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Resizable Handle Component ---
const ResizableHandle: React.FC<{ onMouseDown: (event: React.MouseEvent) => void }> = ({ onMouseDown }) => (
    <div
        className="w-2 cursor-col-resize group flex-shrink-0"
        onMouseDown={onMouseDown}
    >
        <div className="w-0.5 h-full bg-neutral-700/70 group-hover:bg-blue-500 transition-colors mx-auto" />
    </div>
);


// --- History Panel Component ---
interface HistoryPanelProps {
  history: HistoryItem[];
  onView: (item: HistoryItem) => void;
  onCompare: (item: HistoryItem) => void;
  onDelete: (id: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onView, onCompare, onDelete }) => {
  if (history.length === 0) {
    return null; // Don't render anything if there's no history
  }
  return (
    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50">
      <h2 className="text-lg font-semibold text-neutral-100 mb-4">생성 기록</h2>
      <div className="max-h-64 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {[...history].reverse().map((item, index) => {
          const historyNumber = history.length - index;
          return (
            <div key={item.id} className="relative group aspect-square">
              <img
                src={item.thumbnailUrl}
                alt={`생성 기록 ${historyNumber}: ${item.prompt || "프롬프트 없음"}`}
                className="w-full h-full object-cover rounded-md cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => onView(item)}
                aria-label="기록에서 이미지 보기"
              />
              <div className="absolute top-1 left-1 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded-full z-10 pointer-events-none">
                {historyNumber}
              </div>
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 rounded-md pointer-events-none">
                <p className="text-xs text-white text-center line-clamp-2" title={item.prompt}>
                  {item.prompt || "프롬프트 없음"}
                </p>
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCompare(item); }}
                    className="p-1 bg-black/50 text-white rounded-full hover:bg-blue-500 transition-all"
                    aria-label="비교하기"
                    title="비교하기"
                >
                    <CompareIcon width="14" height="14" />
                </button>
                 <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-all"
                    aria-label="기록 삭제"
                    title="기록 삭제"
                >
                    <CloseIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Image Viewer Component ---
interface ImageViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, onClose }) => {
  const [transform, setTransform] = useState({ scale: 1, position: { x: 0, y: 0 } });
  const [isDragging, setIsDragging] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastTouches = useRef<React.TouchEvent['touches'] | null>(null);

  const MAX_ZOOM = 10;
  const MIN_ZOOM = 0.1;
  const ZOOM_SPEED = 1.2;

  const fitImageToScreen = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const onImageLoad = () => {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      if (imgWidth === 0 || imgHeight === 0) return;

      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      const initialScale = Math.min(scaleX, scaleY, 1);

      setTransform({ scale: initialScale, position: { x: 0, y: 0 } });
    }

    if (img.complete) {
      onImageLoad();
    } else {
      img.onload = onImageLoad;
    }
  }, []);
  
  useEffect(() => {
    fitImageToScreen();
    window.addEventListener('resize', fitImageToScreen);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', fitImageToScreen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, fitImageToScreen]);

  const handleZoom = useCallback((direction: 'in' | 'out', anchor?: { x: number, y: number }) => {
    setTransform(prev => {
      const newScale = direction === 'in' ? prev.scale * ZOOM_SPEED : prev.scale / ZOOM_SPEED;
      const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

      const container = containerRef.current;
      if (!container) return { ...prev, scale: clampedScale };

      const anchorPoint = anchor || { x: container.clientWidth / 2, y: container.clientHeight / 2 };
      
      const dx = (anchorPoint.x - prev.position.x) * (1 - clampedScale / prev.scale);
      const dy = (anchorPoint.y - prev.position.y) * (1 - clampedScale / prev.scale);
      
      return {
        scale: clampedScale,
        position: { x: prev.position.x + dx, y: prev.position.y + dy },
      };
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    handleZoom(e.deltaY < 0 ? 'in' : 'out', anchor);
  }, [handleZoom]);

  const startDrag = useCallback((x: number, y: number) => {
    setIsDragging(true);
    panStart.current = { x, y };
  }, []);

  const drag = useCallback((x: number, y: number) => {
    if (!isDragging) return;
    const dx = x - panStart.current.x;
    const dy = y - panStart.current.y;
    panStart.current = { x, y };
    setTransform(prev => ({
      ...prev,
      position: { x: prev.position.x + dx, y: prev.position.y + dy },
    }));
  }, [isDragging]);

  const endDrag = useCallback(() => setIsDragging(false), []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => drag(e.clientX, e.clientY), [drag]);
  const handleMouseUp = useCallback(() => endDrag(), [endDrag]);
  const handleMouseLeave = useCallback(() => endDrag(), [endDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    lastTouches.current = e.touches;
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else {
      setIsDragging(false);
    }
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      drag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && lastTouches.current?.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const lastT1 = lastTouches.current[0];
      const lastT2 = lastTouches.current[1];

      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const lastDist = Math.hypot(lastT1.clientX - lastT2.clientX, lastT1.clientY - lastT2.clientY);
      const scaleFactor = lastDist > 0 ? newDist / lastDist : 1;

      const newMidpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const lastMidpoint = { x: (lastT1.clientX + lastT2.clientX) / 2, y: (lastT1.clientY + lastT2.clientY) / 2 };
      const panDelta = { x: newMidpoint.x - lastMidpoint.x, y: newMidpoint.y - lastMidpoint.y };
      
      setTransform(prev => {
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale * scaleFactor));
        const pannedX = prev.position.x + panDelta.x;
        const pannedY = prev.position.y + panDelta.y;

        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const midpointInContainer = { x: newMidpoint.x - rect.left, y: newMidpoint.y - rect.top };
        
        const dx = (midpointInContainer.x - pannedX) * (1 - newScale / prev.scale);
        const dy = (midpointInContainer.y - pannedY) * (1 - newScale / prev.scale);

        return {
          ...prev,
          scale: newScale,
          position: { x: pannedX + dx, y: pannedY + dy }
        };
      });
    }
    lastTouches.current = e.touches;
  }, [isDragging, drag]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    endDrag();
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
    lastTouches.current = e.touches;
  }, [endDrag, startDrag]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 touch-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Image Viewer"
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Generated character in full screen"
        className="max-w-none max-h-none transition-transform duration-0 ease-linear"
        style={{
          transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale})`,
          cursor: isDragging ? 'grabbing' : 'grab',
          willChange: 'transform',
        }}
        draggable="false"
      />
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a
          href={imageUrl}
          download="generated-character.png"
          className="bg-neutral-900/70 backdrop-blur-sm p-2 text-neutral-200 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Download Image"
          title="Download Image"
        >
          <DownloadIcon />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="bg-neutral-900/70 backdrop-blur-sm p-2 text-neutral-200 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close Viewer"
          title="Close (Esc)"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/70 backdrop-blur-sm rounded-lg p-1.5 flex items-center gap-1 shadow-lg">
        <button type="button" onClick={() => handleZoom('out')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom Out" title="Zoom Out"><ZoomOutIcon /></button>
        <button type="button" onClick={fitImageToScreen} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Reset View" title="Reset View"><ResetIcon /></button>
        <button type="button" onClick={() => handleZoom('in')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom In" title="Zoom In"><ZoomInIcon /></button>
      </div>
    </div>
  );
};

// --- Main App Component ---

const MIN_PANEL_FR = 8; // Minimum fractional unit for a panel

const createThumbnail = (imageUrl: string, size = 128): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const aspect = img.width / img.height;
      let targetWidth, targetHeight;
      if (aspect >= 1) { // landscape or square
        targetWidth = size;
        targetHeight = size / aspect;
      } else { // portrait
        targetHeight = size;
        targetWidth = size * aspect;
      }
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error("Canvas context를 가져올 수 없습니다."));
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = (err) => reject(new Error(`썸네일 이미지 로딩 실패: ${err}`));
    img.src = imageUrl;
  });
};

const compressImageForStorage = (imageUrl: string, quality = 0.9, maxSize = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
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
        return reject(new Error("Canvas context를 가져올 수 없습니다."));
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(new Error(`이미지 압축 중 로딩 실패: ${err}`));
    img.src = imageUrl;
  });
};


export default function App({ userMode, onMasterLogout }: AppProps) { // Receive onMasterLogout prop
  const [poseImages, setPoseImages] = useState<PoseImage[]>([]);
  const [outputStyle, setOutputStyle] = useState<'genga_style' | 'clean_lineart'>('genga_style');
  const [workMode, setWorkMode] = useState<'single' | 'multi'>('single');
  
  const [panelWidths, setPanelWidths] = useState<[number, number, number]>(() => {
    try {
      const savedWidths = localStorage.getItem('character-poser-panel-widths');
      if (savedWidths) {
        const parsed = JSON.parse(savedWidths);
        if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(item => typeof item === 'number')) {
          return parsed as [number, number, number];
        }
      }
    } catch (e) {
      console.error("패널 너비 로딩 실패", e);
    }
    return [14, 60, 26]; // Default widths: ~14%, 60%, ~26%
  });
  
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('character-poser-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("생성 기록 로딩 실패", e);
    }
    return [];
  });

  const [perspectiveData, setPerspectiveData] = useState<PerspectiveData>({ vanishingPoints: [] });
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1000, height: 619 });
  const [sketchBoundingBox, setSketchBoundingBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [comparisonImage, setComparisonImage] = useState<HistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasResetKey, setCanvasResetKey] = useState(0);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [globalReferenceImage, setGlobalReferenceImage] = useState<{ imageDataUrl: string } | null>(null);
  
  const [cameraOptions, setCameraOptions] = useState<CameraOptions>({
    shotType: 'none',
    angleType: 'none',
    lens: '50mm',
    verticalAngle: 0,
    horizontalAngle: 0,
    rollAngle: 0,
    horizontalShift: 0,
    verticalShift: 0,
    dolly: 0,
    zoomLevel: 1.0,
  });

  // Edit mode state management
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editBaseImage, setEditBaseImage] = useState<{ imageDataUrl: string } | null>(null);
  
  // Scene Analysis State
  const [analysisChatHistory, setAnalysisChatHistory] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [directiveInput, setDirectiveInput] = useState('');
  const [negativeDirectiveInput, setNegativeDirectiveInput] = useState('배경 삭제, 컬러링 금지,창작금지.콘티 랜더링 금지');

  const canvasChangeTimeout = useRef<number | null>(null);
  const isGeneratingRef = useRef(false);
  const mainContainerRef = useRef<HTMLElement>(null);

  // Master mode specific state
  const [activeMasterTab, setActiveMasterTab] = useState<'ai-layout' | 'dashboard'>('ai-layout');


  useEffect(() => {
    try {
      localStorage.setItem('character-poser-panel-widths', JSON.stringify(panelWidths));
    } catch (e) {
      console.error("패널 너비 저장 실패", e);
    }
  }, [panelWidths]);
  
  useEffect(() => {
    try {
      localStorage.setItem('character-poser-history', JSON.stringify(history));
    } catch (e) {
      console.error("생성 기록 저장 실패", e);
    }
  }, [history]);
  
  useEffect(() => {
    if (!globalReferenceImage) {
        setIsEditMode(false);
        setEditBaseImage(null);
    }
  }, [globalReferenceImage]);

  const handleCameraChange = useCallback((newOptions: Partial<CameraOptions>) => {
    setCameraOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  const handleCameraReset = useCallback(() => {
    setCameraOptions({
      shotType: 'none',
      angleType: 'none',
      lens: '50mm',
      verticalAngle: 0,
      horizontalAngle: 0,
      rollAngle: 0,
      horizontalShift: 0,
      verticalShift: 0,
      dolly: 0,
      zoomLevel: 1.0,
    });
  }, []);

  const handleResize = useCallback((handleIndex: number, startX: number, initialWidths: [number, number, number]) => {
    const mainContainer = mainContainerRef.current;
    if (!mainContainer) return;

    const totalWidth = mainContainer.getBoundingClientRect().width;
    const totalFr = initialWidths.reduce((sum, w) => sum + w, 0);

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dFr = (dx / totalWidth) * totalFr;
      
      let newWidths = [...initialWidths] as [number, number, number];
      
      newWidths[handleIndex] = initialWidths[handleIndex] + dFr;
      newWidths[handleIndex + 1] = initialWidths[handleIndex + 1] - dFr;

      if (newWidths[handleIndex] < MIN_PANEL_FR) {
        const diff = MIN_PANEL_FR - newWidths[handleIndex];
        newWidths[handleIndex] = MIN_PANEL_FR;
        newWidths[handleIndex + 1] -= diff;
      }
      if (newWidths[handleIndex + 1] < MIN_PANEL_FR) {
        const diff = MIN_PANEL_FR - newWidths[handleIndex + 1];
        newWidths[handleIndex + 1] = MIN_PANEL_FR;
        newWidths[handleIndex] -= diff;
      }

      setPanelWidths(newWidths);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  }, []);

  const handleCanvasChange = useCallback((output: { 
    poses: PoseImage[], 
    perspective: PerspectiveData, 
    dimensions: { width: number, height: number },
    sketchBoundingBox: { x: number, y: number, width: number, height: number } | null,
    lens: string,
    globalReferenceImage: { imageDataUrl: string } | null,
  }) => {
    if (canvasChangeTimeout.current) {
      clearTimeout(canvasChangeTimeout.current);
    }
    canvasChangeTimeout.current = window.setTimeout(() => {
      setPoseImages(output.poses);
      setPerspectiveData(output.perspective);
      setCanvasDimensions(output.dimensions);
      setSketchBoundingBox(output.sketchBoundingBox);
      setGlobalReferenceImage(output.globalReferenceImage);
    }, 300);
  }, []);

  const handleResetClick = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = (options: ResetOptions) => {
    if (options.inputs) {
      // Input is now part of canvas, handled below
    }
    if (options.canvasAndCamera) {
      setPoseImages([]);
      setPerspectiveData({ vanishingPoints: [] });
      setSketchBoundingBox(null);
      setCanvasDimensions({ width: 1000, height: 619 });
      handleCameraReset();
      setAnalysisChatHistory([]);
      setAnalysisError(null);
      setDirectiveInput('');
      setNegativeDirectiveInput('배경 삭제, 컬러링 금지,창작금지.콘티 랜더링 금지');
      setGlobalReferenceImage(null);
      setEditBaseImage(null);
      setIsEditMode(false);
      localStorage.removeItem('character-poser-canvas');
      setCanvasResetKey(key => key + 1);
    }
    if (options.renderingStyle) {
      setOutputStyle('genga_style');
      setWorkMode('single');
    }
    if (options.output) {
      setGeneratedImageUrl(null);
      setComparisonImage(null);
      setError(null);
      setHistory([]);
      localStorage.removeItem('character-poser-history');
    }
    setIsResetModalOpen(false);
  };

  const handleViewHistoryItem = useCallback((item: HistoryItem) => {
    setGeneratedImageUrl(item.imageUrl);
    setComparisonImage(null); // Clear comparison when viewing a new primary image
    setError(null);
  }, []);

  const handleSetComparisonImage = useCallback((item: HistoryItem) => {
    if (generatedImageUrl) {
      setComparisonImage(item);
    } else {
      // If no primary image is set, the clicked image becomes the primary.
      setGeneratedImageUrl(item.imageUrl);
    }
  }, [generatedImageUrl]);

  const handleClearComparison = useCallback(() => {
    setComparisonImage(null);
  }, []);

  const handleDeleteHistoryItem = useCallback((id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleViewImage = useCallback((url: string) => {
    setViewerImageUrl(url);
  }, []);

  const handleEnterEditMode = useCallback((imageUrl: string) => {
    setGeneratedImageUrl(null);
    setComparisonImage(null);
    setError(null);
    setAnalysisChatHistory([]);
    setAnalysisError(null);

    setIsEditMode(true);
    setEditBaseImage({ imageDataUrl: imageUrl });
  }, []);

  const handleAnalyzeScene = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    const params = {
        poseImages,
        globalReferenceImage,
        editBaseImage,
        prompt: '',
        negativePrompt: '',
        perspectiveData,
        canvasDimensions,
        sketchBoundingBox,
        workMode,
        cameraOptions,
    };

    try {
        const { analysisReport } = await analyzeScene(params);
        setAnalysisChatHistory([{ role: 'model', parts: [{ text: analysisReport }] }]);
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : '장면 분석 중 알 수 없는 오류가 발생했습니다.';
        setAnalysisError(errorMessage);
    } finally {
        setIsAnalyzing(false);
    }
  }, [poseImages, perspectiveData, canvasDimensions, sketchBoundingBox, globalReferenceImage, editBaseImage, workMode, cameraOptions]);
  
  const handleContinueAnalysisChat = useCallback(async (newMessage: string) => {
    const newHistory: ChatMessage[] = [...analysisChatHistory, { role: 'user', parts: [{ text: newMessage }] }];
    setAnalysisChatHistory(newHistory);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    if (isEditMode && editBaseImage) {
        try {
            const sketchLayers = poseImages.filter(p => p.imageDataUrl && p.imageDataUrl.length > 0);
            let sketchDataUrl: string | null = null;

            if (sketchLayers.length > 0) {
                if (sketchLayers.length === 1) {
                    sketchDataUrl = sketchLayers[0].imageDataUrl;
                } else {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvasDimensions.width;
                    tempCanvas.height = canvasDimensions.height;
                    const ctx = tempCanvas.getContext('2d');

                    if (ctx) {
                        const imagePromises = sketchLayers.map(layer => {
                            return new Promise<HTMLImageElement>((resolve, reject) => {
                                const img = new Image();
                                img.onload = () => resolve(img);
                                img.onerror = reject;
                                img.src = layer.imageDataUrl;
                            });
                        });
                        
                        const images = await Promise.all(imagePromises);
                        images.forEach(img => ctx.drawImage(img, 0, 0));
                        sketchDataUrl = tempCanvas.toDataURL('image/png');
                    } else {
                        sketchDataUrl = sketchLayers[0].imageDataUrl; // Fallback
                    }
                }
            }
            
            const { newImageUrl, textResponse } = await editImageWithChat({
                baseImageUrl: editBaseImage.imageDataUrl,
                referenceImageUrl: globalReferenceImage?.imageDataUrl,
                sketchImageUrl: sketchDataUrl,
                chatHistory: newHistory,
                newMessage: newMessage,
                cameraOptions,
            });

            setAnalysisChatHistory(prev => [...prev, { role: 'model', parts: [{ text: textResponse }] }]);
            setGeneratedImageUrl(newImageUrl);
            
            // Exit edit mode after chat-based edit
            setIsEditMode(false);
            setEditBaseImage(null);

            try {
              const compressedUrl = await compressImageForStorage(newImageUrl);
              const thumbnailUrl = await createThumbnail(compressedUrl);

              const newHistoryItem: HistoryItem = {
                id: Date.now(),
                imageUrl: compressedUrl,
                thumbnailUrl,
                prompt: `Edit: ${newMessage}`,
                negativePrompt: '',
              };

              setHistory(prev => {
                  const updatedHistory = [...prev, newHistoryItem];
                  const MAX_HISTORY_SIZE = 25; 
                  if (updatedHistory.length > MAX_HISTORY_SIZE) {
                      return updatedHistory.slice(updatedHistory.length - MAX_HISTORY_SIZE);
                  }
                  return updatedHistory;
              });
            } catch (historyError) {
              console.error("Failed to create history item for edited image:", historyError);
            }

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : '이미지 수정 중 알 수 없는 오류가 발생했습니다.';
            setAnalysisError(errorMessage);
            setAnalysisChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `오류: ${errorMessage}` }] }]);
        } finally {
            setIsAnalyzing(false);
        }
    } else {
        try {
            const responseText = await simpleChat(newHistory);
            setAnalysisChatHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : '대화 중 알 수 없는 오류가 발생했습니다.';
            setAnalysisError(errorMessage);
            setAnalysisChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `오류: ${errorMessage}` }] }]);
        } finally {
            setIsAnalyzing(false);
        }
    }
  }, [analysisChatHistory, globalReferenceImage, poseImages, canvasDimensions, isEditMode, editBaseImage, cameraOptions]);


  const handleGenerate = useCallback(async () => {
    if (isGeneratingRef.current) {
      return;
    }

    const layersWithContent = poseImages.filter(p => p.imageDataUrl || (p.points && p.points.length > 0) || (p.setteiImages && p.setteiImages.length > 0));

    if (layersWithContent.length === 0 && !globalReferenceImage) {
      setError('최소 하나의 장면 구성(스케치, 포인트, 또는 설정 이미지)을 제공해야 합니다.');
      return;
    }
    
    const layersWithSettei = poseImages.filter(p => p.setteiImages && p.setteiImages.length > 0);

    if (workMode === 'single') {
        if (layersWithSettei.length === 0) {
            setError('싱글 캐릭터 모드에서는 최소 하나의 레이어에 설정 이미지를 업로드해야 합니다.');
            return;
        }
        if (layersWithSettei.length > 1) {
            setError('싱글 캐릭터 모드에서는 하나의 레이어에만 설정 이미지를 지정할 수 있습니다. 불필요한 설정 이미지를 제거해주세요.');
            return;
        }
    } else { // multi-character logic
        const pointCharacterNames = new Set(
            poseImages.flatMap(p => p.points || []).map(point => point.characterName)
        );
        
        const layerNamesWithSettei = new Set(layersWithSettei.map(l => l.name));
        
        const pointsMissingSettei = [...pointCharacterNames].filter(name => !layerNamesWithSettei.has(name));
        if (pointsMissingSettei.length > 0) {
            setError(`포인트로 지정된 캐릭터("${pointsMissingSettei.join(', ')}")에 대한 설정 이미지가 레이어에 없습니다. 해당 이름의 레이어에 설정 이미지를 추가하세요.`);
            return;
        }
    }


    isGeneratingRef.current = true;
    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null);
    setComparisonImage(null);

    try {
      const [translatedDirective, translatedNegativeDirective] = await Promise.all([
          translateToEnglish(directiveInput.trim()),
          translateToEnglish(negativeDirectiveInput.trim()),
      ]);

      const finalPrompt = translatedDirective;
      const finalNegativePrompt = translatedNegativeDirective;
      
      const imageUrl = await generateCharacterImage({
        poseImages,
        globalReferenceImage,
        editBaseImage,
        prompt: finalPrompt,
        negativePrompt: finalNegativePrompt,
        perspectiveData,
        outputStyle,
        canvasDimensions,
        sketchBoundingBox,
        workMode,
        cameraOptions,
        chatHistory: analysisChatHistory,
      });
      
      setGeneratedImageUrl(imageUrl);
      setEditBaseImage(null);
      setIsEditMode(false);

      try {
        const userMessagesFromHistory = analysisChatHistory
            .filter(msg => msg.role === 'user')
            .flatMap(msg => msg.parts.map(part => part.text.trim()));

        let originalPositive: string[] = [];
        let originalNegative: string[] = [];
        
        const negativeKeywords = [
          'negative prompt:', '네거티브 프롬프트:', '제외:', 'avoid:',
          'don\'t include:', 'without:', '하지마세요:', '그리지 마세요:',
          'exclude:',
        ];
        const uniqueNegativeKeywords = [...new Set(negativeKeywords.map(k => k.toLowerCase()))];

        userMessagesFromHistory.forEach(msg => {
            let isNegative = false;
            for (const keyword of uniqueNegativeKeywords) {
                if (msg.toLowerCase().startsWith(keyword)) {
                    originalNegative.push(msg.substring(keyword.length).trim());
                    isNegative = true;
                    break;
                }
            }
            if (!isNegative) {
                originalPositive.push(msg);
            }
        });
        
        if (directiveInput.trim()) {
            originalPositive.push(directiveInput.trim());
        }
        if (negativeDirectiveInput.trim()) {
            originalNegative.push(negativeDirectiveInput.trim());
        }

        const compressedUrl = await compressImageForStorage(imageUrl);
        const thumbnailUrl = await createThumbnail(compressedUrl);

        const newHistoryItem: HistoryItem = {
          id: Date.now(),
          imageUrl: compressedUrl,
          thumbnailUrl,
          prompt: originalPositive.join(', '),
          negativePrompt: originalNegative.join(', '),
        };

        setHistory(prev => {
            const updatedHistory = [...prev, newHistoryItem];
            const MAX_HISTORY_SIZE = 25; 
            if (updatedHistory.length > MAX_HISTORY_SIZE) {
                return updatedHistory.slice(updatedHistory.length - MAX_HISTORY_SIZE);
            }
            return updatedHistory;
        });
      } catch (historyError) {
        console.error("기록 항목 생성 실패:", historyError);
      }
      
    } catch (err) {
      console.error(err);
      let errorMessage = '이미지 생성 중 알 수 없는 오류가 발생했습니다.';
      if (err instanceof Error) {
        if (err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota')) {
          errorMessage = 'API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 Google Cloud에서 API 할당량을 확인하거나 결제 설정을 검토해야 할 수 있습니다.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
  }, [poseImages, perspectiveData, outputStyle, canvasDimensions, sketchBoundingBox, analysisChatHistory, directiveInput, negativeDirectiveInput, globalReferenceImage, editBaseImage, workMode, cameraOptions]);
  

  return (
    <div className="h-screen w-screen bg-[#1e1e1e] text-neutral-200 flex flex-col overflow-hidden">
      {isLoading && <LoadingOverlay />}
      <ResetModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
      />
      {viewerImageUrl && (
        <ImageViewer
          imageUrl={viewerImageUrl}
          onClose={() => setViewerImageUrl(null)}
        />
      )}
      {/* 고정 헤더 */}
      <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-neutral-700/70 bg-[#2f2f2f] z-10">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-100 tracking-tight flex items-center gap-3">
          <MagicWandIcon />
          AI 애니메이션 레이아웃 어시스턴트 <span className="text-sm font-normal text-neutral-400">({userMode === 'master' ? '마스터 모드' : '게스트 모드'})</span>
        </h1>
        <div className="flex items-center gap-4">
           {userMode === 'master' && (
            <>
              <div className="flex bg-neutral-700/70 p-1 rounded-lg space-x-1">
                <button
                  type="button"
                  onClick={() => setActiveMasterTab('ai-layout')}
                  className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                    activeMasterTab === 'ai-layout'
                      ? 'bg-neutral-500 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-600/50'
                  }`}
                >
                  AI 레이아웃
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMasterTab('dashboard')}
                  className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                    activeMasterTab === 'dashboard'
                      ? 'bg-neutral-500 text-white shadow-sm'
                      : 'text-neutral-300 hover:bg-neutral-600/50'
                  }`}
                >
                  마스터 대시보드
                </button>
              </div>
              <button
                type="button"
                onClick={onMasterLogout} // Use the onMasterLogout prop
                className="text-neutral-200 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="로그아웃"
              >
                <LockIcon />
                로그아웃
              </button>
            </>
          )}
           <button
            type="button"
            onClick={handleResetClick}
            disabled={isLoading}
            className="text-neutral-200 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="모두 초기화"
          >
            <ResetIcon />
            초기화
          </button>
          <a href="https://github.com/google/labs-prototypes/tree/main/frames/character-poser" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">
            <GithubIcon />
          </a>
        </div>
      </header>

      {/* 스크롤 가능한 메인 콘텐츠 */}
       <main
        ref={mainContainerRef}
        className="flex-grow grid p-4 sm:p-6 overflow-hidden"
        style={{
          gridTemplateColumns: userMode === 'master' && activeMasterTab === 'dashboard' ? '1fr' : `${panelWidths[0]}fr auto ${panelWidths[1]}fr auto ${panelWidths[2]}fr`,
        }}
      >
        {userMode === 'master' && activeMasterTab === 'dashboard' ? (
          <MasterDashboard />
        ) : (
          <>
            {/* 입력 섹션 */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
              <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50">
                <h2 className="text-lg font-semibold text-neutral-100 mb-3">1. 렌더링 스타일</h2>
                <p className="text-sm text-neutral-400 mb-4">'원화 스타일'은 캐릭터 설정(Settei) 이미지의 화풍을 100% 복사-붙여넣기 한 것처럼 완벽히 동일한 스타일로 생성합니다. AI는 원작자의 모든 선 특징(굵기, 질감, 스타일)을 그대로 모방해야 합니다.</p>
                <div className="flex bg-neutral-700/70 p-1 rounded-lg space-x-1">
                  <button
                    type="button"
                    onClick={() => setOutputStyle('genga_style')}
                    className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                      outputStyle === 'genga_style'
                        ? 'bg-neutral-500 text-white shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-600/50'
                    }`}
                  >
                    원화 스타일
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputStyle('clean_lineart')}
                    className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                      outputStyle === 'clean_lineart'
                        ? 'bg-neutral-500 text-white shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-600/50'
                    }`}
                  >
                    클린업 라인아트
                  </button>
                </div>
              </div>
              <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50">
                <h2 className="text-lg font-semibold text-neutral-100 mb-3">2. 작업 모드</h2>
                <p className="text-sm text-neutral-400 mb-4">'싱글'은 한 캐릭터의 포즈에, '멀티'는 여러 캐릭터가 등장하는 복잡한 장면에 적합합니다.</p>
                <div className="flex bg-neutral-700/70 p-1 rounded-lg space-x-1">
                  <button
                    type="button"
                    onClick={() => setWorkMode('single')}
                    className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                      workMode === 'single'
                        ? 'bg-neutral-500 text-white shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-600/50'
                    }`}
                  >
                    <UserIconSingle width={16} height={16} />
                    싱글 캐릭터
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkMode('multi')}
                    className={`w-full text-center px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                      workMode === 'multi'
                        ? 'bg-neutral-500 text-white shadow-sm'
                        : 'text-neutral-300 hover:bg-neutral-600/50'
                    }`}
                  >
                    <UsersIcon width={16} height={16} />
                    멀티 캐릭터
                  </button>
                </div>
              </div>
              <CameraControls
                options={cameraOptions}
                onChange={handleCameraChange}
                onResetAll={handleCameraReset}
              />
            </div>

            <ResizableHandle onMouseDown={(e) => handleResize(0, e.clientX, panelWidths)} />

            {/* 포즈 그리기 섹션 */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
              <DrawingCanvas 
                key={`canvas-${canvasResetKey}`}
                title="4. 레이아웃 스케치" 
                description="장면의 레이아웃을 스케치하세요. 각 레이어에 캐릭터의 설정(Settei) 이미지를 직접 업로드하고 포즈를 그립니다. 레이어 이름이 곧 캐릭터 이름이 됩니다." 
                onCanvasChange={handleCanvasChange}
                initialGlobalReferenceUrl={globalReferenceImage?.imageDataUrl}
                editBaseImageUrl={editBaseImage?.imageDataUrl}
              />
              <div className="grid grid-cols-2 gap-6">
                    <SceneAnalysis
                        chatHistory={analysisChatHistory}
                        isLoading={isAnalyzing}
                        error={analysisError}
                        onAnalyze={handleAnalyzeScene}
                        onContinueChat={handleContinueAnalysisChat}
                        disabled={false}
                    />
                    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50 flex flex-col">
                        <h2 className="text-lg font-semibold text-neutral-100 mb-3">6. 연출 지시 (최종 프롬프트)</h2>
                        <p className="text-sm text-neutral-400 mb-4">
                            AI와의 대화와 별개로, 최종 이미지 생성에 항상 반영될 연출 지시사항입니다.
                        </p>

                        {/* Positive Prompt */}
                        <div className="flex flex-col">
                            <label htmlFor="positive-prompt" className="text-base font-medium text-neutral-200 mb-2">긍정적 프롬프트</label>
                            <textarea
                                id="positive-prompt"
                                value={directiveInput}
                                onChange={(e) => setDirectiveInput(e.target.value)}
                                placeholder="연출 지시사항을 입력하세요... (예: 슬픈 표정으로 변경)"
                                disabled={isLoading}
                                className="w-full p-2 bg-neutral-700/80 border border-neutral-600/80 rounded-md text-neutral-200 placeholder-neutral-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-24"
                            />
                        </div>
                        
                        {/* Negative Prompt */}
                        <div className="flex flex-col mt-4">
                            <label htmlFor="negative-prompt" className="text-base font-medium text-neutral-200 mb-2">부정적 프롬프트</label>
                            <textarea
                                id="negative-prompt"
                                value={negativeDirectiveInput}
                                onChange={(e) => setNegativeDirectiveInput(e.target.value)}
                                placeholder="제외할 요소를 입력하세요... (예: 6개의 손가락)"
                                disabled={isLoading}
                                className="w-full p-2 bg-neutral-700/80 border border-neutral-600/80 rounded-md text-neutral-200 placeholder-neutral-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-24"
                            />
                        </div>
                    </div>
              </div>
            </div>
            
            <ResizableHandle onMouseDown={(e) => handleResize(1, e.clientX, panelWidths)} />

            {/* 생성 및 결과 섹션 */}
            <div className="flex flex-col gap-6 overflow-y-auto pr-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900/50 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    생성 중...
                  </>
                ) : (
                  '포즈생성기'
                )}
              </button>
              <HistoryPanel
                history={history}
                onView={handleViewHistoryItem}
                onCompare={handleSetComparisonImage}
                onDelete={handleDeleteHistoryItem}
              />
              <GeneratedImage 
                imageUrl={generatedImageUrl} 
                comparisonImageUrl={comparisonImage?.imageUrl ?? null}
                isLoading={isLoading} 
                error={error} 
                onView={handleViewImage}
                onClearComparison={handleClearComparison}
                onEnterEditMode={handleEnterEditMode}
                onImageUpdate={setGeneratedImageUrl}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
    