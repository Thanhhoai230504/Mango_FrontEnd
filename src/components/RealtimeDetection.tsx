import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { FlipHorizontal, X, Zap } from "lucide-react";
import { DetectionResult, FrameResponse, API_BASE_URL } from "../types";

interface RealtimeDetectionProps {
  onServerWarm: () => void;
}

function RealtimeDetection({ onServerWarm }: RealtimeDetectionProps) {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [isActive, setIsActive] = useState(false);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && detections.length >= 0) {
      drawCanvas();
    }
  }, [detections, isActive]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const webcam = webcamRef.current;

    if (!canvas || !webcam || !webcam.video) return;

    const video = webcam.video;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 640;
    const scaleY = canvas.height / 480;

    detections.forEach((det) => {
      if (!det.bbox || det.bbox.length !== 4) return;

      const [x1_orig, y1_orig, x2_orig, y2_orig] = det.bbox;
      const x1 = x1_orig * scaleX;
      const y1 = y1_orig * scaleY;
      const x2 = x2_orig * scaleX;
      const y2 = y2_orig * scaleY;
      const width = x2 - x1;
      const height = y2 - y1;
      const color = det.label === "fresh" ? "#22c55e" : "#ef4444";

      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x1, y1, width, height);

      const labelText = `${det.label} ${det.confidence}%`;
      ctx.font = "bold 18px sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 20;
      const labelHeight = 35;

      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - labelHeight, labelWidth, labelHeight);
      ctx.fillStyle = "white";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, x1 + 10, y1 - labelHeight / 2);

      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      const cornerSize = 20;

      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerSize);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerSize, y1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerSize);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerSize, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerSize);
      ctx.stroke();
    });
  };

  const startDetection = () => {
    setIsActive(true);
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
          setDetections(
            data.detections && data.detections.length > 0 ? data.detections : []
          );
          onServerWarm();
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
    }, 1000);
  };

  const stopDetection = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
    setIsActive(false);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const videoConstraints = {
    width: { ideal: 800 },
    height: { ideal: 600 },
    facingMode: facingMode,
  };

  return (
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

        {detections.length > 0 && (
          <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥭</span>
              <div>
                <div className="font-bold">
                  {detections.length} xoài phát hiện
                </div>
                <div className="text-xs flex gap-2">
                  <span className="text-green-400">
                    ✓ {detections.filter((d) => d.label === "fresh").length}{" "}
                    tươi
                  </span>
                  <span className="text-red-400">
                    ✗ {detections.filter((d) => d.label === "rotten").length}{" "}
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

          {isActive ? (
            <button
              onClick={stopDetection}
              className="bg-red-500 px-6 py-3 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 text-white font-bold flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Dừng
            </button>
          ) : (
            <button
              onClick={startDetection}
              className="bg-green-500 px-6 py-3 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110 text-white font-bold flex items-center gap-2 animate-pulse"
            >
              <Zap className="w-5 h-5" />
              Bắt Đầu
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            className="bg-red-500/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-800 text-sm text-center">
          <strong>💡 Mẹo:</strong> Giữ camera ổn định và đủ ánh sáng để có kết
          quả tốt nhất. Bounding box sẽ hiện trực tiếp trên video!
        </p>
      </div>
    </div>
  );
}

export default RealtimeDetection;
