export interface CharacterPoint {
  id: number;
  x: number; // Percentage
  y: number; // Percentage
  characterName: string;
  radius: number; // Percentage of canvas width
  color: string;
}

export interface PoseImage {
  name: string;
  imageDataUrl: string; // The sketch data URL, can be empty string
  setteiImages?: { imageUrl: string; maskUrl?: string }[] | null;
  points?: CharacterPoint[];
}

export interface VanishingPoint {
  id: number;
  x: number;
  y: number;
}

export interface PerspectiveData {
  vanishingPoints: VanishingPoint[];
}

export interface HistoryItem {
  id: number;
  imageUrl: string;
  thumbnailUrl: string;
  prompt: string;
  negativePrompt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { 
    text: string;
  }[];
}

export interface UploadedImage {
  id: number;
  name: string;
  file: File;
  preview: string;
  selected: boolean;
}

// FIX: Add CameraOptions interface to resolve import error in CameraControls.tsx
export interface CameraOptions {
  shotType: string;
  angleType: string;
  lens: string;
  verticalAngle: number;
  horizontalAngle: number;
  rollAngle: number;
  horizontalShift: number;
  verticalShift: number;
  dolly: number;
  zoomLevel: number;
}

export type GuestStatus = 'pending' | 'allowed' | 'blocked';

export interface GuestRecord {
  id: string; // The guest's chosen ID (username)
  ipAddress: string;
  loginTime: string; // Last login attempt/request time
  status: GuestStatus; // 'pending', 'allowed', 'blocked'
}