import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Video,
  Camera,
  X,
  Zap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { VideoResponse, API_BASE_URL } from "../types";

interface UploadFileProps {
  onImageSelect: (imageData: string) => void;
  onServerWarm: () => void;
}

function UploadFile({ onImageSelect, onServerWarm }: UploadFileProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoResults, setVideoResults] = useState<VideoResponse | null>(null);

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
          onImageSelect(imageData);
          navigate("/");
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
      onServerWarm();
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

  const resetUpload = () => {
    setSelectedFile(null);
    setVideoResults(null);
    setError(null);
    setUploadProgress(0);
  };

  if (videoResults) {
    return (
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
                    <span className="text-xs font-bold">{det.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={resetUpload}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Phân Tích File Khác
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8">
      <div className="text-center mb-6">
        <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
        <h2 className="text-2xl font-bold mb-2">Upload Video hoặc Hình Ảnh</h2>
        <p className="text-gray-600">Hỗ trợ video và hình ảnh (tối đa 50MB)</p>
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
            onClick={() => navigate("/")}
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
            onClick={() => navigate("/")}
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

      {error && (
        <div className="mt-4 bg-red-50 border-2 border-red-400 rounded-xl p-4">
          <p className="text-red-800 text-sm">🚨 {error}</p>
        </div>
      )}
    </div>
  );
}

export default UploadFile;
