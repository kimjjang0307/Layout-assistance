import React, { useCallback } from 'react';
import type { CameraOptions } from '../types';
import { ResetIcon } from './Icons';

interface CameraControlsProps {
  options: CameraOptions;
  onChange: (newOptions: Partial<CameraOptions>) => void;
  onResetAll: () => void;
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const shotFramingOptions: SelectOption[] = [
  { value: 'none', label: '선택 안함' },
  { value: 'extreme_long_shot', label: '익스트림 롱샷' },
  { value: 'long_shot', label: '롱샷' },
  { value: 'full_shot', label: '풀샷' },
  { value: 'medium_long_shot', label: '미디엄 롱샷' },
  { value: 'cowboy_shot', label: '카우보이샷' },
  { value: 'medium_shot', label: '미디엄샷' },
  { value: 'medium_close_up', label: '미디엄 클로즈업' },
  { value: 'over_the_shoulder_left', label: '오버더숄더 (좌)' },
  { value: 'over_the_shoulder_right', label: '오버더숄더 (우)' },
  { value: 'close_up', label: '클로즈업' },
  { value: 'extreme_close_up', label: '익스트림 클로즈업' },
];

const shotAngleOptions: SelectOption[] = [
  { value: 'none', label: '선택 안함' },
  { value: 'low_angle_shot', label: '로우 앵글' },
  { value: 'high_angle_shot', label: '하이 앵글' },
  { value: 'dutch_angle_shot', label: '더치 앵글' },
  { value: 'birds_eye_view', label: '버즈 아이 뷰 (부감)' },
  { value: 'worms_eye_view', label: '웜즈 아이 뷰 (앙각)' },
];

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

const shotPresets: Record<string, Partial<CameraOptions>> = {
    extreme_long_shot: { dolly: -180, zoomLevel: 1.0, verticalShift: 10, verticalAngle: 10, lens: '24mm' },
    long_shot: { dolly: -120, zoomLevel: 1.0, verticalShift: 5, verticalAngle: 5, lens: '35mm' },
    full_shot: { dolly: -60, zoomLevel: 1.2, verticalShift: 0, verticalAngle: 0, lens: '35mm' },
    medium_long_shot: { dolly: -20, zoomLevel: 1.5, verticalShift: -10, verticalAngle: 0, lens: '50mm' }, // Knees up
    cowboy_shot: { dolly: 0, zoomLevel: 1.6, verticalShift: -15, verticalAngle: 0, lens: '50mm' }, // Mid-thighs up
    medium_shot: { dolly: 20, zoomLevel: 1.8, verticalShift: -20, verticalAngle: 0, lens: '85mm' }, // Waist up
    medium_close_up: { dolly: 40, zoomLevel: 2.2, verticalShift: -25, verticalAngle: 0, lens: '85mm' }, // Chest up
    over_the_shoulder_left: { dolly: 30, zoomLevel: 2.0, verticalShift: -20, horizontalAngle: 15, horizontalShift: -30, lens: '85mm' },
    over_the_shoulder_right: { dolly: 30, zoomLevel: 2.0, verticalShift: -20, horizontalAngle: -15, horizontalShift: 30, lens: '85mm' },
    close_up: { dolly: 60, zoomLevel: 2.8, verticalShift: -30, verticalAngle: -5, lens: '135mm' },
    extreme_close_up: { dolly: 80, zoomLevel: 4.0, verticalShift: -35, verticalAngle: -5, lens: '200mm' },
    // New angle presets
    low_angle_shot: { verticalAngle: -30, lens: '24mm', dolly: -10, verticalShift: -20, zoomLevel: 1.3 },
    high_angle_shot: { verticalAngle: 35, lens: '50mm', dolly: 10, verticalShift: 25, zoomLevel: 1.3 },
    dutch_angle_shot: { rollAngle: 15, lens: '35mm', dolly: 0, zoomLevel: 1.6, verticalShift: -15, verticalAngle: -5 },
    birds_eye_view: { verticalAngle: 80, lens: '24mm', dolly: 100, verticalShift: 60, zoomLevel: 1.8 },
    worms_eye_view: { verticalAngle: -75, lens: '14mm', dolly: -60, verticalShift: -60, zoomLevel: 1.8 },
};

const Slider: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    onReset: () => void;
    unit?: string;
    decimals?: number;
}> = ({ label, value, onChange, min, max, step, onReset, unit, decimals = 0 }) => (
    <div className="flex flex-col">
        <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-neutral-300">{label}</label>
            <div className="flex items-center gap-2">
                <span className="text-sm font-mono bg-neutral-700/80 px-2 py-0.5 rounded">{value.toFixed(decimals)}{unit}</span>
                <button type="button" onClick={onReset} className="text-xs text-neutral-400 hover:text-white" title="초기화">초기화</button>
            </div>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
    </div>
);

export const CameraControls: React.FC<CameraControlsProps> = ({ options, onChange, onResetAll }) => {

  const handleReset = useCallback((key: keyof CameraOptions) => {
    const defaultValues: Partial<CameraOptions> = {
      verticalAngle: 0,
      horizontalAngle: 0,
      rollAngle: 0,
    };
    if (key in defaultValues) {
      onChange({ [key]: defaultValues[key as keyof typeof defaultValues] });
    }
  }, [onChange]);

  const handleShotTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newShotType = e.target.value;
    const preset = shotPresets[newShotType];
    
    if (preset) {
      onChange({
        ...preset,
        shotType: newShotType,
        angleType: 'none', // Reset angle type
      });
    } else {
      onChange({ shotType: newShotType, angleType: 'none' });
    }
  }, [onChange]);

  const handleAngleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAngleType = e.target.value;
    const preset = shotPresets[newAngleType];
    
    if (preset) {
      onChange({
        ...preset,
        angleType: newAngleType,
        shotType: 'none', // Reset shot type
      });
    } else {
      onChange({ angleType: newAngleType, shotType: 'none' });
    }
  }, [onChange]);
  

  return (
    <div className="bg-[#282828] rounded-xl p-5 shadow-md border border-neutral-700/50">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-neutral-100">3. 카메라</h2>
        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetAll}
              className="text-neutral-300 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-md text-sm font-medium"
              title="모든 카메라 설정 초기화"
            >
              <ResetIcon />
              전체 초기화
            </button>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">샷 종류</label>
            <select 
              value={options.shotType} 
              onChange={handleShotTypeChange}
              className="w-full p-2 text-sm bg-neutral-700 border border-neutral-600 rounded-md"
            >
              {shotFramingOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">앵글 종류</label>
            <select 
              value={options.angleType} 
              onChange={handleAngleTypeChange}
              className="w-full p-2 text-sm bg-neutral-700 border border-neutral-600 rounded-md"
            >
              {shotAngleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">렌즈</label>
            <select 
              value={options.lens} 
              onChange={e => onChange({ lens: e.target.value })}
              className="w-full p-2 text-sm bg-neutral-700 border border-neutral-600 rounded-md"
            >
              {lensOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <Slider 
          label="수직 각도 (Tilt)" 
          value={-options.verticalAngle}
          onChange={v => onChange({ verticalAngle: -v })}
          min={-90} max={90} step={5}
          onReset={() => handleReset('verticalAngle')}
          unit="°"
        />
        <Slider 
          label="수평 각도 (Pan)" 
          value={-options.horizontalAngle}
          onChange={v => onChange({ horizontalAngle: -v })}
          min={-180} max={180} step={5}
          onReset={() => handleReset('horizontalAngle')}
          unit="°"
        />
         <Slider
          label="회전 (Roll)"
          value={options.rollAngle}
          onChange={v => onChange({ rollAngle: v })}
          min={-180} max={180} step={5}
          onReset={() => handleReset('rollAngle')}
          unit="°"
        />
      </div>
    </div>
  );
};