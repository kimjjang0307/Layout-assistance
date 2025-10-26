import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DownloadIcon, ImageIcon, ZoomInIcon, ZoomOutIcon, RotateCwIcon, RotateCcwIcon, ExpandIcon, EditIcon, FlipHorizontalIcon, FlipVerticalIcon, SaveIcon, ResetIcon, CloseIcon, UploadIcon } from './Icons';

interface GeneratedImageProps {
  imageUrl: string | null;
  comparisonImageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onView: (imageUrl: string) => void;
  onClearComparison: () => void;
  onEnterEditMode: (imageUrl: string) => void;
  onImageUpdate: (newImageUrl: string) => void;
}

const INITIAL_TRANSFORM = {
  scale: 1,
  position: { x: 0, y: 0 },
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

const MAX_ZOOM = 10;
const MIN_ZOOM = 0.1;
const ZOOM_SPEED = 1.2;

export const GeneratedImage: React.FC<GeneratedImageProps> = ({ imageUrl, comparisonImageUrl, isLoading, error, onView, onClearComparison, onEnterEditMode, onImageUpdate }) => {
  const [transform, setTransform] = useState(INITIAL_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrubbyZooming, setIsScrubbyZooming] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTouches = useRef<React.TouchList | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [compareMode, setCompareMode] = useState<'wipe' | 'opacity'>('wipe');
  const [sliderValue, setSliderValue] = useState(50); // 0-100
  const isWiperDragging = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset view transformations whenever the image source changes.
    setTransform(INITIAL_TRANSFORM);
  }, [imageUrl]);

  const handleReset = useCallback(() => {
    setTransform(INITIAL_TRANSFORM);
  }, []);
  
  const handleSaveView = useCallback(() => {
    if (!imageUrl || !imageRef.current) return;

    const image = imageRef.current;
    const { naturalWidth: w, naturalHeight: h } = image;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rad = (transform.rotation % 360) * Math.PI / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));

    // Calculate the bounding box for the original, unscaled image when rotated.
    const rotatedWidth = w * absCos + h * absSin;
    const rotatedHeight = w * absSin + h * absCos;
    
    // The final canvas size is this rotated bounding box, scaled by the zoom level.
    canvas.width = rotatedWidth * transform.scale;
    canvas.height = rotatedHeight * transform.scale;

    // Apply all transformations to the context
    ctx.translate(canvas.width / 2, canvas.height / 2); // 1. Move origin to the center of the final canvas
    ctx.rotate(rad); // 2. Rotate
    
    // 3. Apply zoom AND any flipping in one go
    ctx.scale(transform.scale * transform.scaleX, transform.scale * transform.scaleY); 

    // Draw the original, untransformed image centered on the new, transformed origin.
    ctx.drawImage(image, -w / 2, -h / 2, w, h);

    const newDataUrl = canvas.toDataURL('image/png');
    
    onImageUpdate(newDataUrl);
    setTransform(INITIAL_TRANSFORM);
  }, [imageUrl, transform, onImageUpdate]);


  const handleZoom = useCallback((direction: 'in' | 'out', anchor?: {x: number, y: number}) => {
    setTransform(prev => {
      const newScale = direction === 'in' ? prev.scale * ZOOM_SPEED : prev.scale / ZOOM_SPEED;
      const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

      if (anchor) {
        const dx = (anchor.x - prev.position.x) * (1 - clampedScale / prev.scale);
        const dy = (anchor.y - prev.position.y) * (1 - clampedScale / prev.scale);
        return {
            ...prev,
            scale: clampedScale,
            position: { x: prev.position.x + dx, y: prev.position.y + dy },
        };
      }
      
      return { ...prev, scale: clampedScale };
    });
  }, []);

  const handleRotate = useCallback((direction: 'cw' | 'ccw') => {
    setTransform(prev => ({
      ...prev,
      rotation: prev.rotation + (direction === 'cw' ? 90 : -90),
    }));
  }, []);
  
  const handleFlipHorizontal = useCallback(() => {
    setTransform(prev => ({ ...prev, scaleX: prev.scaleX * -1 }));
  }, []);

  const handleFlipVertical = useCallback(() => {
    setTransform(prev => ({ ...prev, scaleY: prev.scaleY * -1 }));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    handleZoom(e.deltaY > 0 ? 'out' : 'in', anchor);
  }, [handleZoom]);

  const startDrag = useCallback((x: number, y: number) => {
    setIsDragging(true);
    panStart.current = { x, y };
  }, []);

  const drag = useCallback((x: number, y: number) => {
    if (isWiperDragging.current) {
        const viewport = viewportRef.current;
        if (viewport) {
            const rect = viewport.getBoundingClientRect();
            const newSliderValue = ((x - rect.left) / rect.width) * 100;
            setSliderValue(Math.max(0, Math.min(100, newSliderValue)));
        }
        return;
    }
    if (!isDragging) return;
    const dx = x - panStart.current.x;
    const dy = y - panStart.current.y;
    panStart.current = { x, y };
    setTransform(prev => ({
      ...prev,
      position: {
        x: prev.position.x + dx,
        y: prev.position.y + dy,
      },
    }));
  }, [isDragging]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setIsScrubbyZooming(false);
    isWiperDragging.current = false;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button, input')) return;
    
    // Wiper drag
    if ((e.target as HTMLElement).dataset.wiperHandle) {
        isWiperDragging.current = true;
        return;
    }
    
    if (e.altKey && e.button === 2) {
        e.preventDefault();
        setIsScrubbyZooming(true);
        panStart.current = { x: e.clientX, y: e.clientY };
        return;
    }
    
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isScrubbyZooming) {
        const dx = e.clientX - panStart.current.x;
        panStart.current = { x: e.clientX, y: e.clientY };
        const zoomFactor = Math.pow(1.01, dx);
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        setTransform(prev => {
            const newScale = prev.scale * zoomFactor;
            const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
            const dScale = (1 - clampedScale / prev.scale);
            const dxPan = (anchor.x - prev.position.x) * dScale;
            const dyPan = (anchor.y - prev.position.y) * dScale;
            
            return {
                ...prev,
                scale: clampedScale,
                position: { x: prev.position.x + dxPan, y: prev.position.y + dyPan },
            };
        });
        return;
    }
    drag(e.clientX, e.clientY);
  }, [drag, isScrubbyZooming]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button, input')) return;
    if ((e.target as HTMLElement).dataset.wiperHandle) {
        isWiperDragging.current = true;
        return;
    }
    e.preventDefault();
    lastTouches.current = e.touches;
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
    }
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isWiperDragging.current && e.touches.length === 1) {
        const viewport = viewportRef.current;
        if (viewport) {
            const rect = viewport.getBoundingClientRect();
            const newSliderValue = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
            setSliderValue(Math.max(0, Math.min(100, newSliderValue)));
        }
        return;
    }

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
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      console.error('Selected file is not an image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (dataUrl) {
        onEnterEditMode(dataUrl);
      }
    };
    reader.readAsDataURL(file);

    if (event.target) {
        event.target.value = '';
    }
  };

  const renderSingleView = () => (
    <>
      <img
        ref={imageRef}
        src={imageUrl!}
        alt="Generated character"
        className="object-contain max-w-full max-h-full transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
          cursor: isScrubbyZooming ? 'ew-resize' : isDragging ? 'grabbing' : 'grab',
          willChange: 'transform',
        }}
        draggable="false"
        crossOrigin="anonymous"
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/70 backdrop-blur-sm rounded-lg p-1.5 flex items-center gap-1 shadow-lg">
        <button type="button" onClick={() => handleZoom('in')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom In" title="확대"><ZoomInIcon /></button>
        <button type="button" onClick={() => handleZoom('out')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom Out" title="축소"><ZoomOutIcon /></button>
        <div className="w-px h-6 bg-white/20 mx-1"></div>
        <button type="button" onClick={() => handleRotate('ccw')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Rotate Counter-Clockwise" title="좌회전"><RotateCcwIcon /></button>
        <button type="button" onClick={() => handleRotate('cw')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Rotate Clockwise" title="우회전"><RotateCwIcon /></button>
        <div className="w-px h-6 bg-white/20 mx-1"></div>
        <button type="button" onClick={handleFlipHorizontal} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Flip Horizontal" title="좌우 반전"><FlipHorizontalIcon /></button>
        <button type="button" onClick={handleFlipVertical} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Flip Vertical" title="상하 반전"><FlipVerticalIcon /></button>
        <div className="w-px h-6 bg-white/20 mx-1"></div>
        <button type="button" onClick={handleReset} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Reset View" title="보기 초기화"><ResetIcon /></button>
        <button type="button" onClick={() => onView(imageUrl!)} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="View Fullscreen" title="전체 화면 보기"><ExpandIcon /></button>
        <button type="button" onClick={() => onEnterEditMode(imageUrl!)} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Edit Image" title="수정 모드"><EditIcon /></button>
        <button type="button" onClick={handleSaveView} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Save View" title="변형 저장"><SaveIcon /></button>
        <a
          href={imageUrl!}
          download="generated-character.png"
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center gap-2 text-sm"
        >
          <DownloadIcon />
          다운로드
        </a>
      </div>
    </>
  );

  const renderCompareView = () => (
    <>
      <div 
        className="w-full h-full relative"
        style={{
          transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`,
          cursor: isScrubbyZooming ? 'ew-resize' : (isDragging || isWiperDragging.current) ? 'grabbing' : 'grab',
          willChange: 'transform',
        }}
      >
        <img
            src={comparisonImageUrl!}
            alt="Comparison character"
            className="absolute top-0 left-0 w-full h-full object-contain"
            draggable="false"
        />
        {compareMode === 'wipe' ? (
            <div className="absolute top-0 left-0 h-full w-full overflow-hidden" style={{ width: `${sliderValue}%` }}>
                <img
                    src={imageUrl!}
                    alt="Main character"
                    className="absolute top-0 left-0 h-full w-full object-contain max-w-none"
                    draggable="false"
                />
            </div>
        ) : ( // opacity mode
            <img
                src={imageUrl!}
                alt="Main character"
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{ opacity: sliderValue / 100 }}
                draggable="false"
            />
        )}
      </div>

       {compareMode === 'wipe' && (
        <div
            data-wiper-handle="true"
            className="absolute top-0 h-full w-1.5 bg-blue-500/50 hover:bg-blue-500 transition-colors cursor-ew-resize group"
            style={{ left: `${sliderValue}%`, transform: 'translateX(-50%)' }}
        >
            <div className="w-px h-full bg-white/80 absolute left-1/2 -translate-x-1/2"></div>
        </div>
       )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/70 backdrop-blur-sm rounded-lg p-1.5 flex items-center gap-2 shadow-lg">
        <button type="button" onClick={onClearComparison} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" title="비교 종료"><CloseIcon /></button>
        <div className="w-px h-6 bg-white/20 mx-1"></div>
        <div className="flex items-center bg-neutral-800/60 p-1 rounded-md">
            <button
                type="button"
                onClick={() => setCompareMode('wipe')}
                className={`px-3 py-1 text-xs rounded-md ${compareMode === 'wipe' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-700'}`}
            >
                와이퍼
            </button>
            <button
                type="button"
                onClick={() => setCompareMode('opacity')}
                className={`px-3 py-1 text-xs rounded-md ${compareMode === 'opacity' ? 'bg-blue-600 text-white' : 'hover:bg-neutral-700'}`}
            >
                투명도
            </button>
        </div>
        <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="w-48 h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            aria-label="Comparison slider"
        />
        <div className="w-px h-6 bg-white/20 mx-1"></div>
        <button type="button" onClick={() => handleZoom('in')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom In" title="확대"><ZoomInIcon /></button>
        <button type="button" onClick={() => handleZoom('out')} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom Out" title="축소"><ZoomOutIcon /></button>
        <button type="button" onClick={handleReset} className="p-2 text-neutral-200 hover:bg-white/10 rounded-md transition-colors" aria-label="Reset View" title="보기 초기화"><ResetIcon /></button>
      </div>
    </>
  );

  return (
    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50 flex-grow flex flex-col">
      <h2 className="text-lg font-semibold text-neutral-100 mb-4">생성 결과</h2>
      <div 
        ref={viewportRef}
        className="w-full flex-grow bg-neutral-800/50 rounded-md flex items-center justify-center relative overflow-hidden select-none touch-none"
        onWheel={imageUrl && !isLoading ? handleWheel : undefined}
        onMouseDown={imageUrl && !isLoading ? handleMouseDown : undefined}
        onMouseMove={imageUrl && !isLoading ? handleMouseMove : undefined}
        onMouseUp={imageUrl && !isLoading ? endDrag : undefined}
        onMouseLeave={imageUrl && !isLoading ? endDrag : undefined}
        onTouchStart={imageUrl && !isLoading ? handleTouchStart : undefined}
        onTouchMove={imageUrl && !isLoading ? handleTouchMove : undefined}
        onTouchEnd={imageUrl && !isLoading ? handleTouchEnd : undefined}
        onContextMenu={(e) => { if(isScrubbyZooming || isDragging) e.preventDefault(); }}
      >
        {isLoading && (
          <div className="flex flex-col items-center text-neutral-400">
             <svg className="animate-spin h-10 w-10 text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-lg font-semibold">이미지를 생성하고 있습니다...</p>
            <p className="text-sm">잠시만 기다려주세요.</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="text-center text-red-400 p-4">
            <h3 className="font-bold">오류 발생</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}
        {!isLoading && !error && !imageUrl && (
            <div className="text-center text-neutral-500 flex flex-col items-center gap-4">
                <ImageIcon />
                <p>생성된 이미지가 여기에 표시됩니다.</p>
                <div className="text-sm text-neutral-400">또는</div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                    aria-hidden="true"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    aria-label="수정을 위해 이미지 불러오기"
                >
                    <UploadIcon />
                    이미지 불러오기
                </button>
            </div>
        )}
        {imageUrl && !isLoading && (
          imageUrl && comparisonImageUrl ? renderCompareView() : renderSingleView()
        )}
      </div>
    </div>
  );
};