import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import {
  Camera,
  FlipHorizontal,
  RefreshCw,
  X,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Upload,
  Video,
  Zap,
} from "lucide-react";
import MangoChatbot from "./Chatbot";
interface DetectionResult {
  label: string;
  confidence: number;
  emoji: string;
  message: string;
  bbox: [number, number, number, number];
}

interface ApiResponse {
  results: DetectionResult[];
  image_url: string;
  processing_time?: string;
}

interface VideoDetection {
  frame: number;
  time: number;
  detections: DetectionResult[];
}

interface VideoResponse {
  summary: {
    total_frames: number;
    processed_frames: number;
    total_detections: number;
    fresh_count: number;
    rotten_count: number;
  };
  detections_by_frame: VideoDetection[];
}

interface FrameResponse {
  detections: DetectionResult[];
  timestamp: number;
  frame_base64?: string;
  image_url?: string;
}

type Mode = "home" | "camera" | "realtime" | "upload";

const API_BASE_URL =
  import.meta.env.MODE === "production"
    ? "https://mango-backend-2htc.onrender.com"
    : "http://127.0.0.1:8000";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("home");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isServerWarm, setIsServerWarm] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [showCaptureFlash, setShowCaptureFlash] = useState(false);
  const [showNoMangoDialog, setShowNoMangoDialog] = useState(false);

  // Realtime states
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [realtimeDetections, setRealtimeDetections] = useState<
    DetectionResult[]
  >([]);
  const [fps, setFps] = useState(0);

  // Video states
  const [videoResults, setVideoResults] = useState<VideoResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    warmUpServer();
  }, []);

  useEffect(() => {
    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Redessiner le canvas chaque fois que les détections changent
    if (isRealtimeActive && realtimeDetections.length >= 0) {
      drawCanvas();
    }
  }, [realtimeDetections, isRealtimeActive]);

  const warmUpServer = async () => {
    try {
      setAnalysisStage("Đang khởi động server...");
      const response = await fetch(`${API_BASE_URL}/`, {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        setIsServerWarm(true);
        setAnalysisStage("");
      }
    } catch (error) {
      console.log("Server warm-up failed:", error);
      setAnalysisStage("");
    }
  };

  const resetApp = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setMode("home");
    setCapturedImage(null);
    setAnnotatedImageUrl(null);
    setResults(null);
    setError(null);
    setIsAnalyzing(false);
    setUploadProgress(0);
    setAnalysisStage("");
    setShowNoMangoDialog(false);
    setIsRealtimeActive(false);
    setRealtimeDetections([]);
    setVideoResults(null);
    setSelectedFile(null);
    setFps(0);

    if (annotatedImageUrl) {
      URL.revokeObjectURL(annotatedImageUrl);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // CAPTURE PHOTO MODE
  const openCamera = () => {
    setMode("camera");
    setCapturedImage(null);
    setAnnotatedImageUrl(null);
    setResults(null);
    setError(null);
    setUploadProgress(0);
    setAnalysisStage("");
    setShowNoMangoDialog(false);
  };

  const capturePhoto = useCallback(() => {
    setShowCaptureFlash(true);
    setTimeout(() => setShowCaptureFlash(false), 200);

    const imageSrc = webcamRef.current?.getScreenshot({
      width: 800,
      height: 600,
    });
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setMode("home");
      analyzeImage(imageSrc);
    }
  }, [webcamRef]);

  const compressImage = (
    canvas: HTMLCanvasElement,
    quality: number = 0.7
  ): Promise<Blob> => {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob!);
        },
        "image/jpeg",
        quality
      );
    });
  };

  const analyzeImage = async (imageData: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsAnalyzing(true);
    setError(null);
    setAnnotatedImageUrl(null);
    setUploadProgress(0);
    setShowNoMangoDialog(false);

    try {
      setAnalysisStage("Đang chuẩn bị hình ảnh...");

      const byteString = atob(imageData.split(",")[1]);
      const mimeString = imageData.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      let blob = new Blob([ab], { type: mimeString });

      if (blob.size > MAX_FILE_SIZE) {
        setAnalysisStage("Đang nén hình ảnh...");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const img = new Image();

        await new Promise<void>((resolve) => {
          img.onload = async () => {
            const maxSize = 800;
            let { width, height } = img;

            if (width > height) {
              if (width > maxSize) {
                height = height * (maxSize / width);
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = width * (maxSize / height);
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            blob = await compressImage(canvas, 0.7);
            resolve();
          };
          img.src = imageData;
        });
      }

      setAnalysisStage("Đang tải lên server...");
      setUploadProgress(25);

      const formData = new FormData();
      formData.append("file", blob, "mango.jpg");

      setAnalysisStage(
        !isServerWarm
          ? "Đang khởi động AI (có thể mất 1-2 phút)..."
          : "AI đang phân tích..."
      );
      setUploadProgress(50);

      const apiResponse = await fetch(`${API_BASE_URL}/predict/`, {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      setUploadProgress(75);

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Lỗi server: ${apiResponse.status} - ${errorText}`);
      }

      setAnalysisStage("Đang xử lý kết quả...");
      const data: ApiResponse = await apiResponse.json();

      if (!data.results || data.results.length === 0) {
        setShowNoMangoDialog(true);
        setResults([]);
      } else {
        setResults(data.results);
      }

      setUploadProgress(90);

      if (data.image_url) {
        setAnalysisStage("Đang tải hình ảnh kết quả...");
        try {
          const annotatedImageResponse = await fetch(
            `${API_BASE_URL}${data.image_url}`,
            { signal: abortControllerRef.current.signal }
          );
          if (annotatedImageResponse.ok) {
            const imageBlob = await annotatedImageResponse.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
            setAnnotatedImageUrl(imageUrl);
          }
        } catch (imgError) {
          console.log("Could not load annotated image:", imgError);
        }
      }

      setUploadProgress(100);
      setIsServerWarm(true);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Đã hủy phân tích");
      } else if (err instanceof Error && err.message.includes("timeout")) {
        setError(
          "Kết nối bị timeout. Server có thể đang khởi động, vui lòng thử lại sau 1-2 phút."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định"
        );
      }
      setUploadProgress(0);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage("");
      abortControllerRef.current = null;
    }
  };

  // REALTIME MODE
  const startRealtime = () => {
    setMode("realtime");
    setRealtimeDetections([]);
    setError(null);
    setFps(0);

    setTimeout(() => {
      setIsRealtimeActive(true);
      startRealtimeDetection();
      // ❌ RETIRE cette ligne : drawCanvas();
    }, 500);
  };
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const webcam = webcamRef.current;

    if (!canvas || !webcam || !webcam.video) {
      return; // Ne pas rappeler requestAnimationFrame ici
    }

    const video = webcam.video;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajuster les dimensions du canvas à la vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ IMPORTANT : Calculer le ratio de scale
    const scaleX = canvas.width / 640; // 640 = width de getScreenshot()
    const scaleY = canvas.height / 480; // 480 = height de getScreenshot()

    // Dessiner les bounding boxes
    realtimeDetections.forEach((det) => {
      if (!det.bbox || det.bbox.length !== 4) {
        console.warn("Missing or invalid bbox:", det);
        return;
      }

      // ✅ Appliquer le scale aux coordonnées
      const [x1_orig, y1_orig, x2_orig, y2_orig] = det.bbox;
      const x1 = x1_orig * scaleX;
      const y1 = y1_orig * scaleY;
      const x2 = x2_orig * scaleX;
      const y2 = y2_orig * scaleY;

      const width = x2 - x1;
      const height = y2 - y1;

      // Couleur selon le type
      const color = det.label === "fresh" ? "#22c55e" : "#ef4444";

      // Rectangle principal
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x1, y1, width, height);

      // Fond du label
      const labelText = `${det.emoji} ${det.label} ${det.confidence}%`;
      ctx.font = "bold 18px sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 20;
      const labelHeight = 35;

      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - labelHeight, labelWidth, labelHeight);

      // Texte du label
      ctx.fillStyle = "white";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, x1 + 10, y1 - labelHeight / 2);

      // Coins arrondis (optionnel, plus joli)
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      const cornerSize = 20;

      // Coin haut-gauche
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerSize);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerSize, y1);
      ctx.stroke();

      // Coin haut-droit
      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerSize);
      ctx.stroke();

      // Coin bas-gauche
      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerSize);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerSize, y2);
      ctx.stroke();

      // Coin bas-droit
      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerSize);
      ctx.stroke();
    });
  };

  const startRealtimeDetection = () => {
    let frameCount = 0;
    let lastTime = Date.now();

    realtimeIntervalRef.current = setInterval(async () => {
      if (!webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot({
        width: 640,
        height: 480,
      });

      if (!imageSrc) return;

      try {
        const byteString = atob(imageSrc.split(",")[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([ab], { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");

        const response = await fetch(`${API_BASE_URL}/predict-frame/`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data: FrameResponse = await response.json();

          // ✅ Vérifier que les bbox sont présentes
          if (data.detections && data.detections.length > 0) {
            console.log("Detections received:", data.detections); // Pour debug
            setRealtimeDetections(data.detections);
          } else {
            setRealtimeDetections([]);
          }

          setIsServerWarm(true);
        }

        frameCount++;
        const now = Date.now();
        if (now - lastTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastTime = now;
        }
      } catch (err) {
        console.error("Realtime detection error:", err);
      }
    }, 1000); // Détection toutes les 1 seconde (augmente si tu veux plus de FPS)
  };
  const stopRealtime = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsRealtimeActive(false);
  };

  // VIDEO UPLOAD MODE
  const openVideoUpload = () => {
    setMode("upload");
    setVideoResults(null);
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setError(null);
      } else if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target?.result as string;
          setMode("home");
          analyzeImage(imageData);
        };
        reader.readAsDataURL(file);
      } else {
        setError("Vui lòng chọn file video hoặc hình ảnh");
      }
    }
  };

  const analyzeVideo = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);
    setVideoResults(null);
    setUploadProgress(0);

    try {
      setAnalysisStage("Đang tải video lên...");
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("file", selectedFile);

      setAnalysisStage("AI đang phân tích video (có thể mất vài phút)...");
      setUploadProgress(30);

      const response = await fetch(`${API_BASE_URL}/predict-video/`, {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lỗi server: ${response.status} - ${errorText}`);
      }

      setAnalysisStage("Đang xử lý kết quả...");
      const data: VideoResponse = await response.json();
      setVideoResults(data);
      setUploadProgress(100);
      setIsServerWarm(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định"
      );
      setUploadProgress(0);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage("");
    }
  };

  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAnalyzing(false);
    setAnalysisStage("");
    setUploadProgress(0);
  };

  const videoConstraints = {
    width: { ideal: 800 },
    height: { ideal: 600 },
    facingMode: facingMode,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {showCaptureFlash && (
        <div className="fixed inset-0 bg-white z-50 animate-pulse pointer-events-none" />
      )}

      <header className="bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-400 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl animate-bounce">🥭</span>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Kiểm Tra Chất Lượng Xoài AI
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isServerWarm ? (
                <span className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs md:text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">AI Sẵn Sàng</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 bg-gray-500 text-white px-3 py-1 rounded-full text-xs md:text-sm font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Khởi Động</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* HOME SCREEN */}
        {mode === "home" && !capturedImage && !results && (
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="text-8xl mb-6 animate-bounce">🥭</div>
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
              Kiểm Tra Xoài Tươi Bằng AI
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              🤖 AI thông minh phát hiện nhiều quả xoài cùng lúc
              <br />⚡ Kết quả nhanh chóng và chính xác
            </p>

            {!isServerWarm && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-blue-800 text-sm">
                  <strong>💡 Lưu ý:</strong> Lần đầu sử dụng có thể mất 1-2 phút
                  để khởi động AI. Những lần sau sẽ nhanh như chớp! ⚡
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <button
                onClick={openCamera}
                className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                <Camera className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">📷 Chụp Ảnh</h3>
                <p className="text-sm opacity-90">Chụp và phân tích ngay</p>
              </button>

              <button
                onClick={startRealtime}
                className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                <Zap className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">⚡ Real-time</h3>
                <p className="text-sm opacity-90">Phát hiện trực tiếp</p>
              </button>

              <button
                onClick={openVideoUpload}
                className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                <Upload className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">📤 Upload</h3>
                <p className="text-sm opacity-90">Video hoặc hình ảnh</p>
              </button>
            </div>

            {analysisStage && (
              <div className="mt-6 text-gray-600 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {analysisStage}
              </div>
            )}
          </div>
        )}

        {/* CAMERA MODE */}
        {mode === "camera" && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-auto"
            />

            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4">
              <button
                onClick={switchCamera}
                className="bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-white transition-all hover:scale-110"
              >
                <FlipHorizontal className="w-6 h-6 text-orange-600" />
              </button>

              <button
                onClick={capturePhoto}
                className="bg-orange-500 p-6 rounded-full shadow-lg hover:bg-orange-600 transition-all hover:scale-110 animate-pulse"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>

              <button
                onClick={resetApp}
                className="bg-red-500/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* REALTIME MODE */}
        {mode === "realtime" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden relative">
              <div className="relative w-full h-auto">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-auto"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ objectFit: "cover" }}
                />
              </div>

              {/* Hiển thị số lượng phát hiện ở góc trên */}
              {realtimeDetections.length > 0 && (
                <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🥭</span>
                    <div>
                      <div className="font-bold">
                        {realtimeDetections.length} xoài phát hiện
                      </div>
                      <div className="text-xs flex gap-2">
                        <span className="text-green-400">
                          ✓{" "}
                          {
                            realtimeDetections.filter(
                              (d) => d.label === "fresh"
                            ).length
                          }{" "}
                          tươi
                        </span>
                        <span className="text-red-400">
                          ✗{" "}
                          {
                            realtimeDetections.filter(
                              (d) => d.label === "rotten"
                            ).length
                          }{" "}
                          thối
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-mono">
                {fps} FPS
              </div>

              <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4">
                <button
                  onClick={switchCamera}
                  className="bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-white transition-all hover:scale-110"
                >
                  <FlipHorizontal className="w-6 h-6 text-green-600" />
                </button>

                {isRealtimeActive ? (
                  <button
                    onClick={stopRealtime}
                    className="bg-red-500 px-6 py-3 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 text-white font-bold flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Dừng
                  </button>
                ) : (
                  <button
                    onClick={startRealtimeDetection}
                    className="bg-green-500 px-6 py-3 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110 text-white font-bold flex items-center gap-2 animate-pulse"
                  >
                    <Zap className="w-5 h-5" />
                    Bắt Đầu
                  </button>
                )}

                <button
                  onClick={resetApp}
                  className="bg-red-500/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-blue-800 text-sm text-center">
                <strong>💡 Mẹo:</strong> Giữ camera ổn định và đủ ánh sáng để có
                kết quả tốt nhất. Bounding box sẽ hiện trực tiếp trên video!
              </p>
            </div>
          </div>
        )}

        {/* UPLOAD MODE */}
        {mode === "upload" && !videoResults && (
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <h2 className="text-2xl font-bold mb-2">
                Upload Video hoặc Hình Ảnh
              </h2>
              <p className="text-gray-600">
                Hỗ trợ video và hình ảnh (tối đa 50MB)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-4 border-dashed border-blue-300 rounded-2xl p-12 hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Video className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                  <p className="text-lg font-semibold text-gray-700">
                    Nhấn để chọn file
                  </p>
                </button>
                <button
                  onClick={resetApp}
                  className="w-full mt-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  🏠 Về Trang Chủ
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedFile.type.startsWith("video/") ? (
                      <Video className="w-8 h-8 text-blue-600" />
                    ) : (
                      <Camera className="w-8 h-8 text-blue-600" />
                    )}
                    <div>
                      <p className="font-semibold">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={analyzeVideo}
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Bắt Đầu Phân Tích
                    </>
                  )}
                </button>

                <button
                  onClick={resetApp}
                  className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  Hủy
                </button>
              </div>
            )}

            {isAnalyzing && uploadProgress > 0 && (
              <div className="mt-6">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-600">
                  <span>{analysisStage}</span>
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIDEO RESULTS */}
        {videoResults && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-6">
            <h3 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              📊 Kết Quả Phân Tích Video
            </h3>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {videoResults.summary.processed_frames}
                </p>
                <p className="text-sm text-gray-600">Frames đã xử lý</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {videoResults.summary.total_detections}
                </p>
                <p className="text-sm text-gray-600">Tổng phát hiện</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-600">
                  {videoResults.summary.fresh_count}
                </p>
                <p className="text-sm text-gray-600">Xoài tươi</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-600">
                  {videoResults.summary.rotten_count}
                </p>
                <p className="text-sm text-gray-600">Xoài thối</p>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="font-bold text-lg sticky top-0 bg-white py-2">
                Chi tiết theo frame (50 frame đầu):
              </h4>
              {videoResults.detections_by_frame.map((frameData, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">
                      Frame {frameData.frame} ({frameData.time.toFixed(2)}s)
                    </span>
                    <span className="text-sm text-gray-600">
                      {frameData.detections.length} phát hiện
                    </span>
                  </div>
                  <div className="space-y-1">
                    {frameData.detections.map((det, detIdx) => (
                      <div
                        key={detIdx}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                          det.label === "fresh"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        <span className="text-sm">
                          {det.emoji} {det.message}
                        </span>
                        <span className="text-xs font-bold">
                          {det.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={resetApp}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Phân Tích File Khác
            </button>
          </div>
        )}

        {/* IMAGE RESULTS */}
        {(capturedImage || annotatedImageUrl) &&
          results !== null &&
          mode === "home" && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="relative">
                  {isAnalyzing ? (
                    <img
                      src={capturedImage!}
                      alt="Captured mango"
                      className="w-full h-auto"
                    />
                  ) : annotatedImageUrl ? (
                    <img
                      src={annotatedImageUrl}
                      alt="Analyzed mangoes"
                      className="w-full h-auto"
                    />
                  ) : (
                    <img
                      src={capturedImage!}
                      alt="Captured mango"
                      className="w-full h-auto"
                    />
                  )}

                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6">
                      <div className="text-6xl mb-4 animate-spin">🤖</div>

                      {uploadProgress > 0 && (
                        <div className="w-4/5 mb-4">
                          <div className="bg-white/30 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-orange-500 h-full transition-all duration-300 rounded-full"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-2 text-sm">
                            <span>Tiến độ: {uploadProgress}%</span>
                          </div>
                        </div>
                      )}

                      <h3 className="text-xl font-bold mb-2 text-center">
                        {analysisStage || "Đang phân tích..."}
                      </h3>

                      <button
                        onClick={cancelAnalysis}
                        className="border border-white text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-all mt-4"
                      >
                        ⏹️ Hủy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {results && results.length > 0 && (
                <div className="bg-white rounded-3xl shadow-2xl p-6">
                  <h3 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
                    🎉 Kết Quả ({results.length} quả xoài)
                  </h3>

                  <div className="flex justify-center gap-4 mb-6 flex-wrap">
                    <div className="bg-green-100 border-2 border-green-500 px-6 py-3 rounded-full flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-700">
                        {results.filter((r) => r.label === "fresh").length} Tươi
                        Ngon
                      </span>
                    </div>
                    <div className="bg-red-100 border-2 border-red-500 px-6 py-3 rounded-full flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-red-700">
                        {results.filter((r) => r.label === "rotten").length} Đã
                        Thối
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                          result.label === "fresh"
                            ? "bg-green-50 border-green-400"
                            : "bg-red-50 border-red-400"
                        } transform hover:scale-105 transition-all`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-4xl">{result.emoji}</span>
                          <div>
                            <h4
                              className={`font-bold text-lg ${
                                result.label === "fresh"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              🥭 Quả Xoài #{index + 1}
                            </h4>
                            <p className="text-gray-700">{result.message}</p>
                          </div>
                        </div>

                        <div
                          className={`px-4 py-2 rounded-full font-bold text-white ${
                            result.label === "fresh"
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        >
                          {result.confidence}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={openCamera}
                  disabled={isAnalyzing}
                  className="border-2 border-orange-500 text-orange-600 px-8 py-3 rounded-full font-bold hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  📷 Chụp Lại
                </button>

                <button
                  onClick={resetApp}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  🏠 Trang Chủ
                </button>
              </div>
            </div>
          )}

        {/* NO MANGO DIALOG */}
        {showNoMangoDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-3xl shadow-2xl max-w-md w-full">
              <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white p-6 rounded-t-3xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8" />
                  <h3 className="text-xl font-bold">Không Tìm Thấy Xoài!</h3>
                </div>
                <button
                  onClick={() => setShowNoMangoDialog(false)}
                  className="hover:bg-white/20 rounded-full p-2 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 text-center">
                <div className="text-6xl mb-4">🔍🚫</div>
                <h4 className="text-xl font-bold text-red-600 mb-4">
                  Oops! Không phát hiện được quả xoài nào
                </h4>
                <p className="text-gray-600 mb-4">Để có kết quả tốt nhất:</p>

                <div className="text-left bg-white rounded-xl p-4 mb-6 space-y-2">
                  <p className="text-sm">
                    📸 <strong>Có ít nhất 1 quả xoài trong khung hình</strong>
                  </p>
                  <p className="text-sm">
                    💡 <strong>Chụp ở nơi có ánh sáng tốt</strong>
                  </p>
                  <p className="text-sm">
                    🎯 <strong>Đặt xoài ở giữa khung hình</strong>
                  </p>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      setShowNoMangoDialog(false);
                      openCamera();
                    }}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Thử Lại
                  </button>

                  <button
                    onClick={() => {
                      setShowNoMangoDialog(false);
                      resetApp();
                    }}
                    className="border-2 border-orange-500 text-orange-600 px-6 py-3 rounded-full font-bold hover:bg-orange-50 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Trang Chủ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="text-red-800 font-semibold mb-2">🚨 {error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:bg-red-100 rounded-full p-2 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>
      <MangoChatbot
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />
    </div>
  );
}

export default App;
