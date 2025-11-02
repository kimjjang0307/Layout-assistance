import React from 'react';

type IconProps = {
    className?: string;
} & React.SVGProps<SVGSVGElement>;

const BaseIcon: React.FC<IconProps> = ({ children, width="20", height="20", viewBox="0 0 24 24", ...props }) => (
    <svg 
        width={width} 
        height={height} 
        viewBox={viewBox} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        {children}
    </svg>
);

export const GithubIcon: React.FC<IconProps> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

export const MagicWandIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M15 4V2"/><path d="m19.07 4.93-1.41-1.41"/><path d="M22 10h-2"/><path d="m19.07 15.07-1.41 1.41"/><path d="M15 20v-2"/><path d="m9.93 19.07-1.41-1.41"/><path d="M4 15H2"/><path d="m4.93 9.93-1.41 1.41"/><path d="m14 6-8.5 8.5a.5.5 0 0 0 0 .7.5.5 0 0 0 .7 0L15 7"/><path d="M8 5 6 3"/><path d="m13 14 2 2"/><path d="m3 21 2-2"/></BaseIcon>;
export const CloseIcon: React.FC<IconProps> = (props) => <BaseIcon width="16" height="16" {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></BaseIcon>;
export const TrashIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></BaseIcon>;
export const ResetIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></BaseIcon>;
export const UploadIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></BaseIcon>;
export const PencilIcon: React.FC<IconProps> = (props) => <BaseIcon width="16" height="16" {...props}><><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></></BaseIcon>;
export const LayersIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></BaseIcon>;
export const PlusIcon: React.FC<IconProps> = (props) => <BaseIcon width="18" height="18" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></BaseIcon>;
export const EraserIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z"/><path d="M22 21H7"/><path d="m5 12 5 5"/></BaseIcon>;
export const PenIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></BaseIcon>;
export const ZoomInIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></BaseIcon>;
export const ZoomOutIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></BaseIcon>;
export const ExpandIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="m21 21-6-6m6 6v-4m0 4h-4"/><path d="M3 3l6 6m-6-6v4m0-4h4"/></BaseIcon>;
export const ArrowUpIcon: React.FC<IconProps> = (props) => <BaseIcon width="16" height="16" {...props}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></BaseIcon>;
export const ArrowDownIcon: React.FC<IconProps> = (props) => <BaseIcon width="16" height="16" {...props}><path d="m5 12 7 7 7-7"/><path d="M12 5v14"/></BaseIcon>;
export const UserIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></BaseIcon>;
export const UsersIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></BaseIcon>;
export const SendIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></BaseIcon>;
export const LockIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></BaseIcon>;
export const UnlockIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></BaseIcon>;
export const DownloadIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></BaseIcon>;
export const CompareIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M12 22V2"/><path d="m17 7-5 5-5-5"/><path d="m7 17 5-5 5 5"/></BaseIcon>;
export const FieldGuideIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></BaseIcon>;
export const SafeAreaIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/></BaseIcon>;
export const TargetIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></BaseIcon>;
export const AxisIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M12 20V4"/><path d="m6 14 6 6 6-6"/><path d="M4 12h16"/></BaseIcon>;
export const AngleIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M3 21V3h18"/><path d="M17 8a4 4 0 1 0-8 0"/></BaseIcon>;
export const CircleIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><circle cx="12" cy="12" r="10"/></BaseIcon>;
export const CurveIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M3 21c7-18 18-7 18-18"/></BaseIcon>;
export const EditIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></BaseIcon>;
export const EllipseIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><ellipse cx="12" cy="12" rx="10" ry="6"/></BaseIcon>;
export const EyeIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></BaseIcon>;
export const EyeOffIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></BaseIcon>;
export const FlipHorizontalIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><polyline points="21 12 16 7 16 17 21 12" /><polyline points="3 12 8 7 8 17 3 12" /><line x1="12" y1="22" x2="12" y2="2" /></BaseIcon>;
export const FlipVerticalIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><polyline points="12 21 7 16 17 16 12 21" /><polyline points="12 3 7 8 17 8 12 3" /><line x1="2" y1="12" x2="22" y2="12" /></BaseIcon>;
export const LineIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><line x1="4" y1="20" x2="20" y2="4"/></BaseIcon>;
export const MarkerIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M16 4l4 4-13 13H3v-4L16 4z"/></BaseIcon>;
export const MergeDownIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><polyline points="8 6 12 2 16 6"/><line x1="12" y1="2" x2="12" y2="10"/><path d="M12 22V10"/><path d="M15 15l-3 3-3-3"/></BaseIcon>;
export const OpacityIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 18a6 6 0 0 1 0-12"/></BaseIcon>;
export const RectangleIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="3" y="3" width="18" height="18" rx="2"/></BaseIcon>;
export const RectangleHorizontalIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="2" y="7" width="20" height="10" rx="2"/></BaseIcon>;
export const RedoIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></BaseIcon>;
export const RotateCcwIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M3 12a9 9 0 1 0 1.63-5.32L3 12"/><path d="M3 2v6h6"/></BaseIcon>;
export const RotateCwIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 1 1.63-5.32L3 12"/></BaseIcon>;
export const UndoIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></BaseIcon>;
export const SaveIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></BaseIcon>;
export const BotIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></BaseIcon>;
export const ImageIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></BaseIcon>;
export const CropIcon: React.FC<IconProps> = (props) => <BaseIcon {...props}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></BaseIcon>;
