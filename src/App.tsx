import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
  Fab,
  Chip,
  Alert,
  Slide,
  Fade,
  Card,
  CardContent,
  AppBar,
  Toolbar,
} from "@mui/material";
import {
  CameraAlt,
  FlipCameraIos,
  PhotoCamera,
  RestartAlt,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Custom theme với màu sắc xoài
const theme = createTheme({
  palette: {
    primary: {
      main: "#FF8C00", // Màu cam xoài
      light: "#FFB347",
      dark: "#FF7F00",
    },
    secondary: {
      main: "#32CD32", // Màu xanh tươi
      light: "#90EE90",
      dark: "#228B22",
    },
    error: {
      main: "#FF4444",
      light: "#FF7777",
      dark: "#CC0000",
    },
    background: {
      default: "#FFF8DC", // Màu nền nhẹ như xoài chín
      paper: "#FFFFFF",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 25,
          textTransform: "none",
          fontWeight: 600,
          padding: "12px 24px",
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        },
      },
    },
  },
});

interface DetectionResult {
  label: string;
  confidence: number;
  emoji: string;
  message: string;
}

interface ApiResponse {
  results: DetectionResult[];
  image_url: string;
}

function App() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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

  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement[]>([]);

  // Preload audio for feedback
  useEffect(() => {
    // Tạo audio elements cho feedback âm thanh
    const freshAudio = new Audio();
    const rottenAudio = new Audio();

    // Trong thực tế, bạn cần thêm file âm thanh vào public folder
    freshAudio.src = "/sounds/fresh.mp3";
    rottenAudio.src = "/sounds/rotten.mp3";

    audioRef.current = [freshAudio, rottenAudio];
  }, []);

  const playSound = (isFresh: boolean) => {
    try {
      const audio = audioRef.current[isFresh ? 0 : 1];
      audio?.play().catch((e) => console.log("Audio play failed:", e));
    } catch (e) {
      console.log("Audio not available:", e);
    }
  };

  const openCamera = () => {
    setIsCameraOpen(true);
    setCapturedImage(null);
    setAnnotatedImageUrl(null);
    setResults(null);
    setError(null);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setIsCameraOpen(false);
      analyzeImage(imageSrc);
    }
  }, [webcamRef]);

  const analyzeImage = async (imageData: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnnotatedImageUrl(null);

    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append("file", blob, "mango.jpg");

      // Call API (thay đổi URL này theo backend của bạn)
      const apiResponse = await fetch(
        "https://mango-backend-2htc.onrender.com/predict/",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!apiResponse.ok) {
        throw new Error("Lỗi khi phân tích hình ảnh");
      }

      const data: ApiResponse = await apiResponse.json();
      setResults(data.results);

      // Lấy ảnh đã được gắn khung từ API
      if (data.image_url) {
        const annotatedImageResponse = await fetch(
          `https://mango-backend-2htc.onrender.com${data.image_url}`
        );
        if (annotatedImageResponse.ok) {
          const imageBlob = await annotatedImageResponse.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          setAnnotatedImageUrl(imageUrl);
        }
      }

      // Play sound feedback
      if (data.results.length > 0) {
        // Phát âm thanh dựa trên kết quả tổng thể
        const freshCount = data.results.filter(
          (r) => r.label === "fresh"
        ).length;
        const rottenCount = data.results.filter(
          (r) => r.label === "rotten"
        ).length;

        // Nếu có nhiều xoài tươi hơn thì phát âm thanh tươi
        playSound(freshCount >= rottenCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetApp = () => {
    setIsCameraOpen(false);
    setCapturedImage(null);
    setAnnotatedImageUrl(null);
    setResults(null);
    setError(null);
    setIsAnalyzing(false);

    // Cleanup object URL to prevent memory leaks
    if (annotatedImageUrl) {
      URL.revokeObjectURL(annotatedImageUrl);
    }
  };

  // Cleanup effect for object URLs
  useEffect(() => {
    return () => {
      if (annotatedImageUrl) {
        URL.revokeObjectURL(annotatedImageUrl);
      }
    };
  }, [annotatedImageUrl]);
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode,
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #FFF8DC 0%, #FFE4B5 100%)",
        }}
      >
        {/* Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: "linear-gradient(90deg, #FF8C00 0%, #FFA500 100%)",
          }}
        >
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 700,
                fontSize: "1.3rem",
              }}
            >
              🥭 Kiểm Tra Chất Lượng Xoài
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="sm" sx={{ py: 3 }}>
          {/* Welcome Screen */}
          {!isCameraOpen && !capturedImage && (
            <Fade in timeout={800}>
              <Card sx={{ mb: 3, textAlign: "center", py: 4 }}>
                <CardContent>
                  <Typography
                    variant="h4"
                    gutterBottom
                    sx={{
                      fontSize: "2.5rem",
                      mb: 2,
                    }}
                  >
                    🥭
                  </Typography>
                  <Typography
                    variant="h5"
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      color: "primary.main",
                      mb: 1,
                    }}
                  >
                    Kiểm Tra Xoài Tươi
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Sử dụng AI để phát hiện nhiều quả xoài tươi hay thối cùng
                    lúc
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CameraAlt />}
                    onClick={openCamera}
                    sx={{
                      py: 1.5,
                      px: 4,
                      fontSize: "1.1rem",
                      background:
                        "linear-gradient(45deg, #FF8C00 30%, #FFA500 90%)",
                      "&:hover": {
                        background:
                          "linear-gradient(45deg, #FF7F00 30%, #FF8C00 90%)",
                      },
                    }}
                  >
                    Bắt Đầu Kiểm Tra
                  </Button>
                </CardContent>
              </Card>
            </Fade>
          )}

          {/* Camera View */}
          {isCameraOpen && (
            <Slide direction="up" in={isCameraOpen} timeout={500}>
              <Paper
                elevation={8}
                sx={{
                  borderRadius: 4,
                  overflow: "hidden",
                  mb: 3,
                  position: "relative",
                }}
              >
                <Box sx={{ position: "relative" }}>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                    }}
                  />

                  {/* Camera Controls Overlay */}
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 20,
                      left: 0,
                      right: 0,
                      display: "flex",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <Fab
                      color="secondary"
                      onClick={switchCamera}
                      size="medium"
                      sx={{ opacity: 0.9 }}
                    >
                      <FlipCameraIos />
                    </Fab>

                    <Fab
                      color="primary"
                      onClick={capturePhoto}
                      size="large"
                      sx={{
                        opacity: 0.9,
                        transform: "scale(1.2)",
                      }}
                    >
                      <PhotoCamera />
                    </Fab>

                    <Fab
                      onClick={resetApp}
                      size="medium"
                      sx={{ opacity: 0.9, bgcolor: "error.main" }}
                    >
                      <RestartAlt />
                    </Fab>
                  </Box>
                </Box>
              </Paper>
            </Slide>
          )}

          {/* Analysis Results with Annotated Image */}
          {(capturedImage || annotatedImageUrl) && (
            <Fade in timeout={600}>
              <Paper
                elevation={8}
                sx={{
                  borderRadius: 4,
                  overflow: "hidden",
                  mb: 3,
                }}
              >
                <Box sx={{ position: "relative" }}>
                  {/* Hiển thị ảnh gốc khi đang phân tích, ảnh có khung khi đã xong */}
                  {isAnalyzing ? (
                    <img
                      src={capturedImage!}
                      alt="Captured mango"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  ) : annotatedImageUrl ? (
                    <img
                      src={annotatedImageUrl}
                      alt="Analyzed mangoes with detection boxes"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  ) : (
                    <img
                      src={capturedImage!}
                      alt="Captured mango"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  )}

                  {/* Loading Overlay */}
                  {isAnalyzing && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                      }}
                    >
                      <CircularProgress
                        size={60}
                        sx={{ color: "#FFA500", mb: 2 }}
                      />
                      <Typography variant="h6">Đang phân tích...</Typography>
                      <Typography variant="body2">
                        Vui lòng đợi một chút
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Fade>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <Slide direction="up" in timeout={700}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      textAlign: "center",
                      fontWeight: 600,
                      mb: 3,
                    }}
                  >
                    Kết Quả Phân Tích ({results.length} quả xoài)
                  </Typography>

                  {/* Tổng quan kết quả */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 2,
                      mb: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip
                      icon={<Typography>✅</Typography>}
                      label={`${
                        results.filter((r) => r.label === "fresh").length
                      } Tươi`}
                      color="secondary"
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip
                      icon={<Typography>❌</Typography>}
                      label={`${
                        results.filter((r) => r.label === "rotten").length
                      } Thối`}
                      color="error"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>

                  {/* Chi tiết từng quả */}
                  {results.map((result, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        px: 3,
                        borderRadius: 3,
                        mb: index < results.length - 1 ? 2 : 0,
                        backgroundColor:
                          result.label === "fresh"
                            ? "rgba(50, 205, 50, 0.1)"
                            : "rgba(255, 68, 68, 0.1)",
                        border:
                          result.label === "fresh"
                            ? "2px solid #32CD32"
                            : "2px solid #FF4444",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        <Typography variant="h4">{result.emoji}</Typography>
                        <Box>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 600,
                              color:
                                result.label === "fresh"
                                  ? "secondary.dark"
                                  : "error.dark",
                              mb: 0.5,
                            }}
                          >
                            Quả #{index + 1}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {result.message}
                          </Typography>
                        </Box>
                      </Box>

                      <Chip
                        label={`${result.confidence}%`}
                        color={result.label === "fresh" ? "secondary" : "error"}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          minWidth: "60px",
                        }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Slide>
          )}

          {/* Error Message */}
          {error && (
            <Fade in timeout={500}>
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            </Fade>
          )}

          {/* Action Buttons */}
          {(capturedImage || results || annotatedImageUrl) && (
            <Fade in timeout={800}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  justifyContent: "center",
                  mt: 3,
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<CameraAlt />}
                  onClick={openCamera}
                  sx={{
                    borderRadius: 25,
                    px: 3,
                    py: 1,
                    borderWidth: 2,
                    "&:hover": {
                      borderWidth: 2,
                    },
                  }}
                >
                  Chụp Lại
                </Button>

                <Button
                  variant="contained"
                  startIcon={<RestartAlt />}
                  onClick={resetApp}
                  color="primary"
                  sx={{
                    borderRadius: 25,
                    px: 3,
                    py: 1,
                  }}
                >
                  Bắt Đầu Lại
                </Button>
              </Box>
            </Fade>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
