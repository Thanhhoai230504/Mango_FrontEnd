import { useState, useEffect, useCallback } from 'react';
import { buildApiUrl, ENDPOINTS, API_CONFIG } from '../untils/config';

interface ServerStatus {
  isOnline: boolean;
  isWarm: boolean;
  modelLoaded: boolean;
  isChecking: boolean;
  lastCheck: number | null;
  error: string | null;
}

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    isWarm: false,
    modelLoaded: false,
    isChecking: false,
    lastCheck: null,
    error: null,
  });

  const checkServerStatus = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setStatus(prev => ({ ...prev, isChecking: true, error: null }));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.HEALTH_CHECK_TIMEOUT);

      const response = await fetch(buildApiUrl(ENDPOINTS.HEALTH), {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        setStatus(prev => ({
          ...prev,
          isOnline: true,
          isWarm: data.status === 'healthy',
          modelLoaded: data.model_loaded === true,
          isChecking: false,
          lastCheck: Date.now(),
          error: null,
        }));
        
        return true;
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (error) {
      const isTimeout = error instanceof Error && 
        (error.name === 'AbortError' || error.message.includes('timeout'));
      
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isWarm: false,
        modelLoaded: false,
        isChecking: false,
        lastCheck: Date.now(),
        error: isTimeout ? 'Server không phản hồi (có thể đang khởi động)' : 'Không thể kết nối đến server',
      }));
      
      return false;
    }
  }, []);

  const warmUpServer = useCallback(async () => {
    // Try basic health check first
    const isHealthy = await checkServerStatus();
    
    if (!isHealthy) {
      // If health check fails, try root endpoint to wake up server
      try {
        setStatus(prev => ({ ...prev, isChecking: true, error: null }));
        
        const response = await fetch(buildApiUrl('/'), {
          method: 'GET',
          signal: AbortSignal.timeout(30000), // 30 second timeout for warmup
        });
        
        if (response.ok) {
          // Wait a bit then check health again
          setTimeout(() => checkServerStatus(), 2000);
        }
      } catch (error) {
        console.warn('Warmup request failed:', error);
      }
    }
  }, [checkServerStatus]);

  // Initial server check and warmup
  useEffect(() => {
    warmUpServer();
    
    // Set up periodic checks every 30 seconds
    const interval = setInterval(() => {
      checkServerStatus(false); // Don't show loading for background checks
    }, 30000);

    return () => clearInterval(interval);
  }, [warmUpServer, checkServerStatus]);

  // Retry connection when online status changes
  useEffect(() => {
    const handleOnline = () => {
      if (navigator.onLine) {
        setTimeout(() => checkServerStatus(), 1000);
      }
    };

    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isWarm: false,
        error: 'Không có kết nối internet',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkServerStatus]);

  return {
    ...status,
    checkServerStatus,
    warmUpServer,
  };
};