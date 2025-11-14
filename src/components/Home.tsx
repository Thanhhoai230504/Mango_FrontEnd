import { Camera, Upload, Zap, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HomeProps {
  isServerWarm: boolean;
  analysisStage: string;
}

function Home({ isServerWarm, analysisStage }: HomeProps) {
  const navigate = useNavigate();

  return (
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
            <strong>💡 Lưu ý:</strong> Lần đầu sử dụng có thể mất 1-2 phút để
            khởi động AI. Những lần sau sẽ nhanh như chớp! ⚡
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <button
          onClick={() => navigate("/camera")}
          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
        >
          <Camera className="w-12 h-12 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">📷 Chụp Ảnh</h3>
          <p className="text-sm opacity-90">Chụp và phân tích ngay</p>
        </button>

        <button
          onClick={() => navigate("/realtime")}
          className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
        >
          <Zap className="w-12 h-12 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">⚡ Real-time</h3>
          <p className="text-sm opacity-90">Phát hiện trực tiếp</p>
        </button>

        <button
          onClick={() => navigate("/upload")}
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
  );
}

export default Home;
