
import { useState, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import {
  Camera,
  RefreshCw,
  X,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import Home from "./components/Home";
import CameraCapture from "./components/CameraCapture";
import RealtimeDetection from "./components/RealtimeDetection";
import UploadFile from "./components/UploadFile";
import MangoChatbot from "./Chatbot";
import {
  DetectionResult,
  ApiResponse,
  RecommendationResponse,
  API_BASE_URL,
  MAX_FILE_SIZE,
} from "./types";

function AppContent() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isServerWarm, setIsServerWarm] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [showNoMangoDialog, setShowNoMangoDialog] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    warmUpServer();
  }, []);

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

  const fetchAiRecommendation = async (
    freshCount: number,
    rottenCount: number
  ) => {
    setIsLoadingRecommendation(true);
    try {
      const response = await fetch(`${API_BASE_URL}/get-recommendation/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fresh_count: freshCount,
          rotten_count: rottenCount,
        }),
      });

      if (response.ok) {
        const data: RecommendationResponse = await response.json();
        setAiRecommendation(data.recommendation);
      }
    } catch (err) {
      console.error("Error fetching recommendation:", err);
    } finally {
      setIsLoadingRecommendation(false);
    }
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
    setAiRecommendation(null);

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

        const freshCount = data.results.filter(
          (r: DetectionResult) => r.label === "fresh"
        ).length;
        const rottenCount = data.results.filter(
          (r: DetectionResult) => r.label === "rotten"
        ).length;
        fetchAiRecommendation(freshCount, rottenCount);
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

  const handleCapture = (imageData: string) => {
    setCapturedImage(imageData);
    analyzeImage(imageData);
  };

  const handleImageSelect = (imageData: string) => {
    setCapturedImage(imageData);
    analyzeImage(imageData);
  };

  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAnalyzing(false);
    setAnalysisStage("");
    setUploadProgress(0);
  };

  const resetToHome = () => {
    setCapturedImage(null);
    setAnnotatedImageUrl(null);
    setResults(null);
    setError(null);
    setIsAnalyzing(false);
    setUploadProgress(0);
    setAnalysisStage("");
    setShowNoMangoDialog(false);
    setAiRecommendation(null);
    setIsLoadingRecommendation(false);

    if (annotatedImageUrl) {
      URL.revokeObjectURL(annotatedImageUrl);
    }
  };

  const openCamera = () => {
    resetToHome();
    navigate("/camera");
  };

  const showResults =
    capturedImage || annotatedImageUrl || (isAnalyzing && results);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(251, 146, 60, 0.5); }
          50% { box-shadow: 0 0 40px rgba(251, 146, 60, 0.8), 0 0 60px rgba(251, 146, 60, 0.4); }
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>

      <header className="bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-400 shadow-2xl relative z-10 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-yellow-500/20 animate-shimmer"></div>
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 group">
              <span className="text-5xl animate-float transition-transform duration-300 group-hover:scale-110">
                🥭
              </span>
              <div>
                <h1 className="text-xl md:text-3xl font-black text-white drop-shadow-lg tracking-tight">
                  Kiểm Tra Chất Lượng Xoài AI
                </h1>
                <p className="text-xs md:text-sm text-white/90 font-medium flex items-center gap-1 mt-1">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
                  Powered by Artificial Intelligence
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isServerWarm ? (
                <span className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-xs md:text-sm font-bold shadow-lg animate-glow">
                  <CheckCircle className="w-4 h-4 animate-pulse" />
                  <span className="hidden sm:inline">AI Sẵn Sàng</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-full text-xs md:text-sm font-bold shadow-lg animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Khởi Động</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        <Routes>
          <Route
            path="/"
            element={
              showResults ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {isAnalyzing && !capturedImage && !annotatedImageUrl && (
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 border border-orange-100 animate-in zoom-in duration-300">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="relative mb-8">
                          <div className="text-9xl animate-float">🥭</div>
                          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                            <Loader2 className="w-16 h-16 text-orange-500 animate-spin drop-shadow-lg" />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-orange-200/30 to-transparent rounded-full blur-2xl"></div>
                        </div>

                        <h3 className="text-3xl font-black mb-6 bg-gradient-to-r from-orange-600 via-red-500 to-green-600 bg-clip-text text-transparent animate-pulse">
                          {analysisStage || "Đang phân tích hình ảnh..."}
                        </h3>

                        {uploadProgress > 0 && (
                          <div className="w-full max-w-md mb-8">
                            <div className="bg-gray-200 rounded-full h-5 overflow-hidden shadow-inner">
                              <div
                                className="bg-gradient-to-r from-orange-500 via-red-500 to-green-500 h-full transition-all duration-500 ease-out rounded-full relative overflow-hidden"
                                style={{ width: `${uploadProgress}%` }}
                              >
                                <div className="absolute inset-0 animate-shimmer"></div>
                              </div>
                            </div>
                            <div className="flex justify-between mt-3 text-sm font-bold text-gray-700">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-4 h-4 text-orange-500" />
                                Tiến độ
                              </span>
                              <span className="text-orange-600">
                                {uploadProgress}%
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3 mb-6">
                          {[0, 150, 300].map((delay, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-full animate-bounce shadow-lg"
                              style={{ animationDelay: `${delay}ms` }}
                            ></div>
                          ))}
                        </div>

                        <button
                          onClick={cancelAnalysis}
                          className="mt-4 border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-full font-bold hover:bg-gray-50 transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:shadow-lg"
                        >
                          <X className="w-5 h-5" />
                          Hủy Phân Tích
                        </button>
                      </div>
                    </div>
                  )}

                  {(capturedImage || annotatedImageUrl) && (
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-orange-100 animate-in zoom-in duration-500">
                      <div className="relative group">
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
                            className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <img
                            src={capturedImage!}
                            alt="Captured mango"
                            className="w-full h-auto"
                          />
                        )}

                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/80 to-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 animate-in fade-in duration-300">
                            <div className="text-7xl mb-6 animate-spin">🤖</div>

                            {uploadProgress > 0 && (
                              <div className="w-4/5 mb-6">
                                <div className="bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm shadow-inner">
                                  <div
                                    className="bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 h-full transition-all duration-500 rounded-full relative overflow-hidden"
                                    style={{ width: `${uploadProgress}%` }}
                                  >
                                    <div className="absolute inset-0 animate-shimmer"></div>
                                  </div>
                                </div>
                                <div className="flex justify-between mt-3 text-sm font-bold">
                                  <span>Tiến độ: {uploadProgress}%</span>
                                </div>
                              </div>
                            )}

                            <h3 className="text-2xl font-black mb-4 text-center animate-pulse bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                              {analysisStage || "Đang phân tích..."}
                            </h3>

                            <button
                              onClick={cancelAnalysis}
                              className="border-2 border-white/80 text-white px-6 py-3 rounded-full hover:bg-white/20 transition-all duration-300 mt-4 font-bold hover:scale-105 backdrop-blur-sm"
                            >
                              ⏹️ Hủy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {results && results.length > 0 && (
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-orange-100 animate-in slide-in-from-bottom-8 duration-500">
                      <h3 className="text-3xl font-black text-center mb-8 bg-gradient-to-r from-orange-600 via-red-500 to-green-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
                        <span className="text-4xl animate-bounce">🎉</span>
                        Kết Quả ({results.length} quả xoài)
                        <span className="text-4xl animate-bounce animation-delay-2000">
                          ✨
                        </span>
                      </h3>

                      <div className="flex justify-center gap-6 mb-8 flex-wrap">
                        <div className="bg-gradient-to-br from-green-100 to-emerald-50 border-3 border-green-500 px-8 py-4 rounded-full flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in slide-in-from-left duration-500">
                          <CheckCircle className="w-6 h-6 text-green-600 animate-pulse" />
                          <span className="font-black text-green-700 text-lg">
                            {results.filter((r) => r.label === "fresh").length}{" "}
                            Tươi Ngon
                          </span>
                        </div>
                        <div className="bg-gradient-to-br from-red-100 to-rose-50 border-3 border-red-500 px-8 py-4 rounded-full flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in slide-in-from-right duration-500">
                          <XCircle className="w-6 h-6 text-red-600 animate-pulse" />
                          <span className="font-black text-red-700 text-lg">
                            {results.filter((r) => r.label === "rotten").length}{" "}
                            Đã Thối
                          </span>
                        </div>
                      </div>

                      {(aiRecommendation || isLoadingRecommendation) && (
                        <div className="mb-8 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border-3 border-purple-300 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 animate-in zoom-in duration-500">
                          <div className="flex items-start gap-4">
                            <div className="text-4xl animate-float">🤖</div>
                            <div className="flex-1">
                              <h4 className="text-xl font-black text-purple-700 mb-3 flex items-center gap-3">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                                💡 Khuyến Nghị Từ AI
                                {isLoadingRecommendation && (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                )}
                              </h4>
                              {isLoadingRecommendation ? (
                                <div className="flex items-center gap-3 text-gray-600">
                                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                  <span className="font-semibold">
                                    AI đang suy nghĩ...
                                  </span>
                                </div>
                              ) : (
                                <p className="text-gray-800 leading-relaxed whitespace-pre-line font-medium">
                                  {aiRecommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-5">
                        {results.map((result, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-6 rounded-2xl border-3 ${
                              result.label === "fresh"
                                ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 hover:from-green-100 hover:to-emerald-100"
                                : "bg-gradient-to-r from-red-50 to-rose-50 border-red-400 hover:from-red-100 hover:to-rose-100"
                            } transform hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl animate-in slide-in-from-bottom-4 cursor-pointer`}
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <div className="flex items-center gap-5">
                              <div>
                                <h4
                                  className={`font-black text-xl mb-1 ${
                                    result.label === "fresh"
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  🥭 Quả Xoài #{index + 1}
                                </h4>
                                <p className="text-gray-700 font-semibold">
                                  {result.message}
                                </p>
                              </div>
                            </div>

                            <div
                              className={`px-6 py-3 rounded-full font-black text-white text-lg shadow-lg ${
                                result.label === "fresh"
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                  : "bg-gradient-to-r from-red-500 to-rose-500"
                              } animate-glow`}
                            >
                              {result.confidence}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-5 justify-center flex-wrap animate-in slide-in-from-bottom-4 duration-500">
                    <button
                      onClick={openCamera}
                      disabled={isAnalyzing}
                      className="border-3 border-orange-500 text-orange-600 px-10 py-4 rounded-full font-black text-lg hover:bg-orange-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <Camera className="w-6 h-6" />
                      📷 Chụp Lại
                    </button>

                    <button
                      onClick={resetToHome}
                      className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 text-white px-10 py-4 rounded-full font-black text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3 animate-glow"
                    >
                      <RefreshCw className="w-6 h-6" />
                      🏠 Trang Chủ
                    </button>
                  </div>
                </div>
              ) : (
                <Home
                  isServerWarm={isServerWarm}
                  analysisStage={analysisStage}
                />
              )
            }
          />
          <Route
            path="/camera"
            element={<CameraCapture onCapture={handleCapture} />}
          />
          <Route
            path="/realtime"
            element={
              <RealtimeDetection onServerWarm={() => setIsServerWarm(true)} />
            }
          />
          <Route
            path="/upload"
            element={
              <UploadFile
                onImageSelect={handleImageSelect}
                onServerWarm={() => setIsServerWarm(true)}
              />
            }
          />
        </Routes>

        {showNoMangoDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50 rounded-3xl shadow-2xl max-w-md w-full border-2 border-orange-200 animate-in zoom-in duration-300">
              <div className="bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 text-white p-6 rounded-t-3xl flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 animate-pulse" />
                  <h3 className="text-xl font-black">Không Tìm Thấy Xoài!</h3>
                </div>
                <button
                  onClick={() => setShowNoMangoDialog(false)}
                  className="hover:bg-white/20 rounded-full p-2 transition-all duration-300 hover:scale-110"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 text-center">
                <div className="text-7xl mb-6 animate-bounce">🔍🚫</div>
                <h4 className="text-2xl font-black text-red-600 mb-4 animate-pulse">
                  Oops! Không phát hiện được quả xoài nào
                </h4>
                <p className="text-gray-700 mb-6 font-semibold">
                  Để có kết quả tốt nhất:
                </p>

                <div className="text-left bg-white rounded-2xl p-6 mb-8 space-y-3 shadow-lg border border-orange-100">
                  <p className="text-sm font-semibold text-gray-700 hover:text-orange-600 transition-colors duration-300">
                    📸 <strong>Có ít nhất 1 quả xoài trong khung hình</strong>
                  </p>
                  <p className="text-sm font-semibold text-gray-700 hover:text-orange-600 transition-colors duration-300">
                    💡 <strong>Chụp ở nơi có ánh sáng tốt</strong>
                  </p>
                  <p className="text-sm font-semibold text-gray-700 hover:text-orange-600 transition-colors duration-300">
                    🎯 <strong>Đặt xoài ở giữa khung hình</strong>
                  </p>
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      setShowNoMangoDialog(false);
                      openCamera();
                    }}
                    className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 text-white px-8 py-4 rounded-full font-black shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3 animate-glow"
                  >
                    <Camera className="w-5 h-5" />
                    Thử Lại
                  </button>

                  <button
                    onClick={() => {
                      setShowNoMangoDialog(false);
                      resetToHome();
                    }}
                    className="border-3 border-orange-500 text-orange-600 px-8 py-4 rounded-full font-black hover:bg-orange-50 transition-all duration-300 flex items-center gap-3 hover:scale-105 shadow-lg"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Trang Chủ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border-3 border-red-400 rounded-2xl p-6 mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-7 h-7 text-red-600 flex-shrink-0 mt-1 animate-pulse" />
              <div className="flex-1">
                <p className="text-red-800 font-black text-lg mb-2">
                  🚨 {error}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:bg-red-100 rounded-full p-2 transition-all duration-300 hover:scale-110"
              >
                <X className="w-6 h-6" />
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

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
