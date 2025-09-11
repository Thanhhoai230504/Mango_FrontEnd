import { useState, useCallback, useRef } from 'react';
import { API_CONFIG, buildApiUrl, ENDPOINTS, createTimeoutController } from '../untils/config';

interface DetectionResult {
  label: string;
  confidence: number;
  emoji: string;
  message: string;
}

interface ApiResponse {
  results: DetectionResult[];
  image_url: string;
  processing_time?: string;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: string;
  error: string | null;
}

export const useImageProcessor = () => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: '',
    error: null,
  });
  
  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateState = useCallback((updates: Partial<ProcessingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const compressImage = useCallback(async (imageData: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = async () => {
        const { width: maxWidth, height: maxHeight } = API_CONFIG.MAX_DIMENSIONS;
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        width *= scale;
        height *= scale;
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Failed to compress image')),
          'image/jpeg',
          API_CONFIG.JPEG_QUALITY
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }, []);

  const processImage = useCallback(async (imageData: string): Promise<void> => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = createTimeoutController();
    
    setState({
      isProcessing: true,
      progress: 0,
      stage: 'Đang chuẩn bị hình ảnh...',
      error: null,
    });

    setResults(null);
    setAnnotatedImageUrl(null);

    try {
      // Compress image
      updateState({ stage: 'Đang nén hình ảnh...', progress: 10 });
      const blob = await compressImage(imageData);
      
      if (blob.size > API_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`Kích thước file quá lớn. Tối đa ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      // Prepare form data
      updateState({ stage: 'Đang tải lên server...', progress: 25 });
      const formData = new FormData();
      formData.append('file', blob, 'mango.jpg');

      // Send to API
      updateState({ stage: 'AI đang phân tích...', progress: 50 });
      const apiResponse = await fetch(buildApiUrl(ENDPOINTS.PREDICT), {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      updateState({ progress: 75 });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Lỗi server: ${apiResponse.status} - ${errorText}`);
      }

      // Parse results
      updateState({ stage: 'Đang xử lý kết quả...', progress: 85 });
      const data: ApiResponse = await apiResponse.json();
      setResults(data.results);

      // Load annotated image if available
      if (data.image_url) {
        updateState({ stage: 'Đang tải hình ảnh kết quả...', progress: 95 });
        try {
          const imageResponse = await fetch(
            buildApiUrl(data.image_url),
            { signal: abortControllerRef.current.signal }
          );
          
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
            setAnnotatedImageUrl(imageUrl);
          }
        } catch (imgError) {
          console.warn('Could not load annotated image:', imgError);
          // Continue without annotated image
        }
      }

      updateState({ stage: 'Hoàn thành!', progress: 100 });
      
      // Clear processing state after a short delay
      setTimeout(() => {
        setState(prev => ({ ...prev, isProcessing: false, stage: '', progress: 0 }));
      }, 1000);

    } catch (error) {
      let errorMessage = 'Đã xảy ra lỗi không xác định';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Đã hủy phân tích';
        } else if (error.message.includes('timeout') || error.message.includes('fetch')) {
          errorMessage = 'Kết nối bị timeout. Server có thể đang khởi động, vui lòng thử lại sau 1-2 phút.';
        } else {
          errorMessage = error.message;
        }
      }

      setState({
        isProcessing: false,
        progress: 0,
        stage: '',
        error: errorMessage,
      });
    } finally {
      abortControllerRef.current = null;
    }
  }, [compressImage, updateState]);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isProcessing: false,
      progress: 0,
      stage: '',
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (annotatedImageUrl) {
      URL.revokeObjectURL(annotatedImageUrl);
    }
    
    setState({
      isProcessing: false,
      progress: 0,
      stage: '',
      error: null,
    });
    
    setResults(null);
    setAnnotatedImageUrl(null);
  }, [annotatedImageUrl]);

  return {
    // State
    ...state,
    results,
    annotatedImageUrl,
    
    // Actions
    processImage,
    cancelProcessing,
    clearError,
    cleanup,
  };
};