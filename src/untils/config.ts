// Configuration file for API endpoints and settings
export const API_CONFIG = {
  // Use environment variable or fallback to local development
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 
           (import.meta.env.PROD ? 'https://mango-backend-2htc.onrender.com' : 'http://127.0.0.1:8000'),
  
  // Timeout settings
  REQUEST_TIMEOUT: 120000, // 2 minutes
  HEALTH_CHECK_TIMEOUT: 10000, // 10 seconds
  
  // File upload settings  
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png'],
  
  // Image compression settings
  MAX_DIMENSIONS: {
    width: 800,
    height: 600
  },
  JPEG_QUALITY: 0.8,
  
  // UI settings
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds
};

export const ENDPOINTS = {
  HEALTH: '/health',
  PREDICT: '/predict/',
  DOWNLOAD: '/download',
  CLEANUP: '/cleanup',
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to create abort controller with timeout
export const createTimeoutController = (timeout: number = API_CONFIG.REQUEST_TIMEOUT): AbortController => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
};