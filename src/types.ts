export interface DetectionResult {
  label: string;
  confidence: number;
  emoji: string;
  message: string;
  bbox: [number, number, number, number];
}

export interface ApiResponse {
  results: DetectionResult[];
  image_url: string;
  processing_time?: string;
}

export interface RecommendationResponse {
  recommendation: string;
}

export interface VideoDetection {
  frame: number;
  time: number;
  detections: DetectionResult[];
}

export interface VideoResponse {
  summary: {
    total_frames: number;
    processed_frames: number;
    total_detections: number;
    fresh_count: number;
    rotten_count: number;
  };
  detections_by_frame: VideoDetection[];
}

export interface FrameResponse {
  detections: DetectionResult[];
  timestamp: number;
  frame_base64?: string;
  image_url?: string;
}

export type Mode = "home" | "camera" | "realtime" | "upload";

export const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? "https://mango-backend-2htc.onrender.com"
    : "http://127.0.0.1:8000";

export const MAX_FILE_SIZE = 5 * 1024 * 1024;