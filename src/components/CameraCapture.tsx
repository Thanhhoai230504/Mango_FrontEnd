import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { Camera, FlipHorizontal, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
}

function CameraCapture({ onCapture }: CameraCaptureProps) {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [showFlash, setShowFlash] = useState(false);

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const imageSrc = webcamRef.current?.getScreenshot({
      width: 800,
      height: 600,
    });

    if (imageSrc) {
      onCapture(imageSrc);
      navigate("/");
    }
  }, [webcamRef, onCapture, navigate]);

  const videoConstraints = {
    width: { ideal: 800 },
    height: { ideal: 600 },
    facingMode: facingMode,
  };

  return (
    <>
      {showFlash && (
        <div className="fixed inset-0 bg-white z-50 animate-pulse pointer-events-none" />
      )}

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
            onClick={() => navigate("/")}
            className="bg-red-500/90 backdrop-blur-sm p-4 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}

export default CameraCapture;
