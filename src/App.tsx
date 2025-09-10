// import React, { useState, useRef, useCallback, useEffect } from "react";
// import {
//   Container,
//   Paper,
//   Typography,
//   Button,
//   Box,
//   CircularProgress,
//   Fab,
//   Chip,
//   Alert,
//   Slide,
//   Fade,
//   Card,
//   CardContent,
//   AppBar,
//   Toolbar,
// } from "@mui/material";
// import {
//   CameraAlt,
//   FlipCameraIos,
//   PhotoCamera,
//   RestartAlt,
// } from "@mui/icons-material";
// import Webcam from "react-webcam";
// import { createTheme, ThemeProvider } from "@mui/material/styles";
// import CssBaseline from "@mui/material/CssBaseline";

// // Custom theme với màu sắc xoài
// const theme = createTheme({
//   palette: {
//     primary: {
//       main: "#FF8C00", // Màu cam xoài
//       light: "#FFB347",
//       dark: "#FF7F00",
//     },
//     secondary: {
//       main: "#32CD32", // Màu xanh tươi
//       light: "#90EE90",
//       dark: "#228B22",
//     },
//     error: {
//       main: "#FF4444",
//       light: "#FF7777",
//       dark: "#CC0000",
//     },
//     background: {
//       default: "#FFF8DC", // Màu nền nhẹ như xoài chín
//       paper: "#FFFFFF",
//     },
//   },
//   components: {
//     MuiButton: {
//       styleOverrides: {
//         root: {
//           borderRadius: 25,
//           textTransform: "none",
//           fontWeight: 600,
//           padding: "12px 24px",
//         },
//       },
//     },
//     MuiFab: {
//       styleOverrides: {
//         root: {
//           boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
//         },
//       },
//     },
//     MuiCard: {
//       styleOverrides: {
//         root: {
//           borderRadius: 20,
//           boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
//         },
//       },
//     },
//   },
// });

// interface DetectionResult {
//   label: string;
//   confidence: number;
//   emoji: string;
//   message: string;
// }

// interface ApiResponse {
//   results: DetectionResult[];
//   image_url: string;
// }

// function App() {
//   const [isCameraOpen, setIsCameraOpen] = useState(false);
//   const [capturedImage, setCapturedImage] = useState<string | null>(null);
//   const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(
//     null
//   );
//   const [isAnalyzing, setIsAnalyzing] = useState(false);
//   const [results, setResults] = useState<DetectionResult[] | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [facingMode, setFacingMode] = useState<"user" | "environment">(
//     "environment"
//   );

//   const webcamRef = useRef<Webcam>(null);
//   const audioRef = useRef<HTMLAudioElement[]>([]);

//   // Preload audio for feedback
//   useEffect(() => {
//     // Tạo audio elements cho feedback âm thanh
//     const freshAudio = new Audio();
//     const rottenAudio = new Audio();

//     // Trong thực tế, bạn cần thêm file âm thanh vào public folder
//     freshAudio.src = "/sounds/fresh.mp3";
//     rottenAudio.src = "/sounds/rotten.mp3";

//     audioRef.current = [freshAudio, rottenAudio];
//   }, []);

//   const playSound = (isFresh: boolean) => {
//     try {
//       const audio = audioRef.current[isFresh ? 0 : 1];
//       audio?.play().catch((e) => console.log("Audio play failed:", e));
//     } catch (e) {
//       console.log("Audio not available:", e);
//     }
//   };

//   const openCamera = () => {
//     setIsCameraOpen(true);
//     setCapturedImage(null);
//     setAnnotatedImageUrl(null);
//     setResults(null);
//     setError(null);
//   };

//   const switchCamera = () => {
//     setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
//   };

//   const capturePhoto = useCallback(() => {
//     const imageSrc = webcamRef.current?.getScreenshot();
//     if (imageSrc) {
//       setCapturedImage(imageSrc);
//       setIsCameraOpen(false);
//       analyzeImage(imageSrc);
//     }
//   }, [webcamRef]);

//   const analyzeImage = async (imageData: string) => {
//     setIsAnalyzing(true);
//     setError(null);
//     setAnnotatedImageUrl(null);

//     try {
//       // Nếu imageData là base64, convert về Blob
//       const byteString = atob(imageData.split(",")[1]);
//       const mimeString = imageData.split(",")[0].split(":")[1].split(";")[0];
//       const ab = new ArrayBuffer(byteString.length);
//       const ia = new Uint8Array(ab);
//       for (let i = 0; i < byteString.length; i++) {
//         ia[i] = byteString.charCodeAt(i);
//       }
//       const blob = new Blob([ab], { type: mimeString });

//       // Tạo form data
//       const formData = new FormData();
//       formData.append("file", blob, "mango.jpg");

//       // Gọi API backend
//       const apiResponse = await fetch(
//         "https://web-production-91ffc.up.railway.app/predict/",
//         {
//           method: "POST",
//           body: formData,
//         }
//       );

//       if (!apiResponse.ok) {
//         throw new Error("Lỗi khi phân tích hình ảnh");
//       }

//       const data: ApiResponse = await apiResponse.json();
//       setResults(data.results);

//       // Load ảnh annotated từ backend nếu có
//       if (data.image_url) {
//         const annotatedImageResponse = await fetch(
//           `https://web-production-91ffc.up.railway.app${data.image_url}`
//         );
//         if (annotatedImageResponse.ok) {
//           const imageBlob = await annotatedImageResponse.blob();
//           const imageUrl = URL.createObjectURL(imageBlob);
//           setAnnotatedImageUrl(imageUrl);
//         }
//       }

//       // Phát âm thanh phản hồi
//       if (data.results.length > 0) {
//         const freshCount = data.results.filter(
//           (r) => r.label === "fresh"
//         ).length;
//         const rottenCount = data.results.filter(
//           (r) => r.label === "rotten"
//         ).length;

//         playSound(freshCount >= rottenCount);
//       }
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
//     } finally {
//       setIsAnalyzing(false);
//     }
//   };

//   const resetApp = () => {
//     setIsCameraOpen(false);
//     setCapturedImage(null);
//     setAnnotatedImageUrl(null);
//     setResults(null);
//     setError(null);
//     setIsAnalyzing(false);

//     // Cleanup object URL to prevent memory leaks
//     if (annotatedImageUrl) {
//       URL.revokeObjectURL(annotatedImageUrl);
//     }
//   };

//   // Cleanup effect for object URLs
//   useEffect(() => {
//     return () => {
//       if (annotatedImageUrl) {
//         URL.revokeObjectURL(annotatedImageUrl);
//       }
//     };
//   }, [annotatedImageUrl]);
//   const videoConstraints = {
//     width: 1280,
//     height: 720,
//     facingMode: facingMode,
//   };

//   return (
//     <ThemeProvider theme={theme}>
//       <CssBaseline />
//       <Box
//         sx={{
//           minHeight: "100vh",
//           background: "linear-gradient(135deg, #FFF8DC 0%, #FFE4B5 100%)",
//         }}
//       >
//         {/* Header */}
//         <AppBar
//           position="static"
//           elevation={0}
//           sx={{
//             background: "linear-gradient(90deg, #FF8C00 0%, #FFA500 100%)",
//           }}
//         >
//           <Toolbar>
//             <Typography
//               variant="h6"
//               component="div"
//               sx={{
//                 flexGrow: 1,
//                 fontWeight: 700,
//                 fontSize: "1.3rem",
//               }}
//             >
//               🥭 Kiểm Tra Chất Lượng Xoài
//             </Typography>
//           </Toolbar>
//         </AppBar>

//         <Container maxWidth="sm" sx={{ py: 3 }}>
//           {/* Welcome Screen */}
//           {!isCameraOpen && !capturedImage && (
//             <Fade in timeout={800}>
//               <Card sx={{ mb: 3, textAlign: "center", py: 4 }}>
//                 <CardContent>
//                   <Typography
//                     variant="h4"
//                     gutterBottom
//                     sx={{
//                       fontSize: "2.5rem",
//                       mb: 2,
//                     }}
//                   >
//                     🥭
//                   </Typography>
//                   <Typography
//                     variant="h5"
//                     gutterBottom
//                     sx={{
//                       fontWeight: 600,
//                       color: "primary.main",
//                       mb: 1,
//                     }}
//                   >
//                     Kiểm Tra Xoài Tươi
//                   </Typography>
//                   <Typography
//                     variant="body1"
//                     color="text.secondary"
//                     sx={{ mb: 3 }}
//                   >
//                     Sử dụng AI để phát hiện nhiều quả xoài tươi hay thối cùng
//                     lúc
//                   </Typography>
//                   <Button
//                     variant="contained"
//                     size="large"
//                     startIcon={<CameraAlt />}
//                     onClick={openCamera}
//                     sx={{
//                       py: 1.5,
//                       px: 4,
//                       fontSize: "1.1rem",
//                       background:
//                         "linear-gradient(45deg, #FF8C00 30%, #FFA500 90%)",
//                       "&:hover": {
//                         background:
//                           "linear-gradient(45deg, #FF7F00 30%, #FF8C00 90%)",
//                       },
//                     }}
//                   >
//                     Bắt Đầu Kiểm Tra
//                   </Button>
//                 </CardContent>
//               </Card>
//             </Fade>
//           )}

//           {/* Camera View */}
//           {isCameraOpen && (
//             <Slide direction="up" in={isCameraOpen} timeout={500}>
//               <Paper
//                 elevation={8}
//                 sx={{
//                   borderRadius: 4,
//                   overflow: "hidden",
//                   mb: 3,
//                   position: "relative",
//                 }}
//               >
//                 <Box sx={{ position: "relative" }}>
//                   <Webcam
//                     audio={false}
//                     ref={webcamRef}
//                     screenshotFormat="image/jpeg"
//                     videoConstraints={videoConstraints}
//                     style={{
//                       width: "100%",
//                       height: "auto",
//                       display: "block",
//                     }}
//                   />

//                   {/* Camera Controls Overlay */}
//                   <Box
//                     sx={{
//                       position: "absolute",
//                       bottom: 20,
//                       left: 0,
//                       right: 0,
//                       display: "flex",
//                       justifyContent: "center",
//                       gap: 2,
//                     }}
//                   >
//                     <Fab
//                       color="secondary"
//                       onClick={switchCamera}
//                       size="medium"
//                       sx={{ opacity: 0.9 }}
//                     >
//                       <FlipCameraIos />
//                     </Fab>

//                     <Fab
//                       color="primary"
//                       onClick={capturePhoto}
//                       size="large"
//                       sx={{
//                         opacity: 0.9,
//                         transform: "scale(1.2)",
//                       }}
//                     >
//                       <PhotoCamera />
//                     </Fab>

//                     <Fab
//                       onClick={resetApp}
//                       size="medium"
//                       sx={{ opacity: 0.9, bgcolor: "error.main" }}
//                     >
//                       <RestartAlt />
//                     </Fab>
//                   </Box>
//                 </Box>
//               </Paper>
//             </Slide>
//           )}

//           {/* Analysis Results with Annotated Image */}
//           {(capturedImage || annotatedImageUrl) && (
//             <Fade in timeout={600}>
//               <Paper
//                 elevation={8}
//                 sx={{
//                   borderRadius: 4,
//                   overflow: "hidden",
//                   mb: 3,
//                 }}
//               >
//                 <Box sx={{ position: "relative" }}>
//                   {/* Hiển thị ảnh gốc khi đang phân tích, ảnh có khung khi đã xong */}
//                   {isAnalyzing ? (
//                     <img
//                       src={capturedImage!}
//                       alt="Captured mango"
//                       style={{
//                         width: "100%",
//                         height: "auto",
//                         display: "block",
//                       }}
//                     />
//                   ) : annotatedImageUrl ? (
//                     <img
//                       src={annotatedImageUrl}
//                       alt="Analyzed mangoes with detection boxes"
//                       style={{
//                         width: "100%",
//                         height: "auto",
//                         display: "block",
//                       }}
//                     />
//                   ) : (
//                     <img
//                       src={capturedImage!}
//                       alt="Captured mango"
//                       style={{
//                         width: "100%",
//                         height: "auto",
//                         display: "block",
//                       }}
//                     />
//                   )}

//                   {/* Loading Overlay */}
//                   {isAnalyzing && (
//                     <Box
//                       sx={{
//                         position: "absolute",
//                         top: 0,
//                         left: 0,
//                         right: 0,
//                         bottom: 0,
//                         backgroundColor: "rgba(0,0,0,0.5)",
//                         display: "flex",
//                         flexDirection: "column",
//                         alignItems: "center",
//                         justifyContent: "center",
//                         color: "white",
//                       }}
//                     >
//                       <CircularProgress
//                         size={60}
//                         sx={{ color: "#FFA500", mb: 2 }}
//                       />
//                       <Typography variant="h6">Đang phân tích...</Typography>
//                       <Typography variant="body2">
//                         Vui lòng đợi một chút
//                       </Typography>
//                     </Box>
//                   )}
//                 </Box>
//               </Paper>
//             </Fade>
//           )}

//           {/* Results */}
//           {results && results.length > 0 && (
//             <Slide direction="up" in timeout={700}>
//               <Card sx={{ mb: 3 }}>
//                 <CardContent>
//                   <Typography
//                     variant="h6"
//                     gutterBottom
//                     sx={{
//                       textAlign: "center",
//                       fontWeight: 600,
//                       mb: 3,
//                     }}
//                   >
//                     Kết Quả Phân Tích ({results.length} quả xoài)
//                   </Typography>

//                   {/* Tổng quan kết quả */}
//                   <Box
//                     sx={{
//                       display: "flex",
//                       justifyContent: "center",
//                       gap: 2,
//                       mb: 3,
//                       flexWrap: "wrap",
//                     }}
//                   >
//                     <Chip
//                       icon={<Typography>✅</Typography>}
//                       label={`${
//                         results.filter((r) => r.label === "fresh").length
//                       } Tươi`}
//                       color="secondary"
//                       sx={{ fontWeight: 600 }}
//                     />
//                     <Chip
//                       icon={<Typography>❌</Typography>}
//                       label={`${
//                         results.filter((r) => r.label === "rotten").length
//                       } Thối`}
//                       color="error"
//                       sx={{ fontWeight: 600 }}
//                     />
//                   </Box>

//                   {/* Chi tiết từng quả */}
//                   {results.map((result, index) => (
//                     <Box
//                       key={index}
//                       sx={{
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "space-between",
//                         py: 2,
//                         px: 3,
//                         borderRadius: 3,
//                         mb: index < results.length - 1 ? 2 : 0,
//                         backgroundColor:
//                           result.label === "fresh"
//                             ? "rgba(50, 205, 50, 0.1)"
//                             : "rgba(255, 68, 68, 0.1)",
//                         border:
//                           result.label === "fresh"
//                             ? "2px solid #32CD32"
//                             : "2px solid #FF4444",
//                       }}
//                     >
//                       <Box
//                         sx={{ display: "flex", alignItems: "center", gap: 2 }}
//                       >
//                         <Typography variant="h4">{result.emoji}</Typography>
//                         <Box>
//                           <Typography
//                             variant="h6"
//                             sx={{
//                               fontWeight: 600,
//                               color:
//                                 result.label === "fresh"
//                                   ? "secondary.dark"
//                                   : "error.dark",
//                               mb: 0.5,
//                             }}
//                           >
//                             Quả #{index + 1}
//                           </Typography>
//                           <Typography variant="body2" color="text.secondary">
//                             {result.message}
//                           </Typography>
//                         </Box>
//                       </Box>

//                       <Chip
//                         label={`${result.confidence}%`}
//                         color={result.label === "fresh" ? "secondary" : "error"}
//                         size="small"
//                         sx={{
//                           fontWeight: 600,
//                           minWidth: "60px",
//                         }}
//                       />
//                     </Box>
//                   ))}
//                 </CardContent>
//               </Card>
//             </Slide>
//           )}

//           {/* Error Message */}
//           {error && (
//             <Fade in timeout={500}>
//               <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
//                 {error}
//               </Alert>
//             </Fade>
//           )}

//           {/* Action Buttons */}
//           {(capturedImage || results || annotatedImageUrl) && (
//             <Fade in timeout={800}>
//               <Box
//                 sx={{
//                   display: "flex",
//                   gap: 2,
//                   justifyContent: "center",
//                   mt: 3,
//                 }}
//               >
//                 <Button
//                   variant="outlined"
//                   startIcon={<CameraAlt />}
//                   onClick={openCamera}
//                   sx={{
//                     borderRadius: 25,
//                     px: 3,
//                     py: 1,
//                     borderWidth: 2,
//                     "&:hover": {
//                       borderWidth: 2,
//                     },
//                   }}
//                 >
//                   Chụp Lại
//                 </Button>

//                 <Button
//                   variant="contained"
//                   startIcon={<RestartAlt />}
//                   onClick={resetApp}
//                   color="primary"
//                   sx={{
//                     borderRadius: 25,
//                     px: 3,
//                     py: 1,
//                   }}
//                 >
//                   Bắt Đầu Lại
//                 </Button>
//               </Box>
//             </Fade>
//           )}
//         </Container>
//       </Box>
//     </ThemeProvider>
//   );
// }

// export default App;



import  { useState, useRef, useCallback, useEffect } from "react";
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
  LinearProgress,
} from "@mui/material";
import {
  CameraAlt,
  FlipCameraIos,
  PhotoCamera,
  RestartAlt,
  Speed,
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
  total_detected?: number;
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
  const [serverStatus, setServerStatus] = useState<string>("unknown");
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement[]>([]);

  const API_BASE_URL = "https://mango-backend-2htc.onrender.com";

  // ✅ Keep-alive và warm-up server
  useEffect(() => {
    const warmUpServer = async () => {
      try {
        setServerStatus("warming up");
        const response = await fetch(`${API_BASE_URL}/warmup`, {
          method: "GET",
        });

        if (response.ok) {
          setServerStatus("ready");
          console.log("✅ Server warmed up successfully");
        } else {
          setServerStatus("error");
        }
      } catch (error) {
        console.log("⚠️ Server warm-up failed:", error);
        setServerStatus("offline");
      }
    };

    warmUpServer();

    // ✅ Keep-alive every 8 minutes
    const keepAliveInterval = setInterval(async () => {
      try {
        await fetch(`${API_BASE_URL}/health`);
        console.log("✅ Keep-alive ping sent");
      } catch (error) {
        console.log("❌ Keep-alive failed:", error);
      }
    }, 480000); // 8 minutes

    return () => clearInterval(keepAliveInterval);
  }, []);

  // Preload audio for feedback
  useEffect(() => {
    const freshAudio = new Audio();
    const rottenAudio = new Audio();
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
    setAnalysisTime(null);
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

  // ✅ Optimize image compression
  const compressImage = (base64: string, maxWidth: number = 800): string => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8)); // 80% quality
      };
      img.src = base64;
    }) as any;
  };

  const analyzeImage = async (imageData: string) => {
    const startTime = Date.now();
    setIsAnalyzing(true);
    setError(null);
    setAnnotatedImageUrl(null);

    try {
      // ✅ Compress image before sending
      const compressedImage = await compressImage(imageData, 800);

      // Convert to blob
      const byteString = atob(compressedImage.split(",")[1]);
      const mimeString = compressedImage
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      const formData = new FormData();
      formData.append("file", blob, "mango.jpg");

      // ✅ Increased timeout for render.com
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

      const apiResponse = await fetch(`${API_BASE_URL}/predict/`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!apiResponse.ok) {
        throw new Error(`Server error: ${apiResponse.status}`);
      }

      const data: ApiResponse = await apiResponse.json();
      setResults(data.results);

      // Calculate analysis time
      const endTime = Date.now();
      setAnalysisTime(Math.round((endTime - startTime) / 1000));

      // Load annotated image
      if (data.image_url) {
        try {
          const annotatedImageResponse = await fetch(
            `${API_BASE_URL}${data.image_url}`
          );
          if (annotatedImageResponse.ok) {
            const imageBlob = await annotatedImageResponse.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
            setAnnotatedImageUrl(imageUrl);
          }
        } catch (imgError) {
          console.log("Could not load annotated image:", imgError);
          // Không hiển thị error cho user, chỉ log
        }
      }

      // Play sound feedback
      if (data.results.length > 0) {
        const freshCount = data.results.filter(
          (r) => r.label === "fresh"
        ).length;
        const rottenCount = data.results.filter(
          (r) => r.label === "rotten"
        ).length;

        playSound(freshCount >= rottenCount);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      if (err instanceof Error && err.name === "AbortError") {
        setError("Phân tích quá lâu, vui lòng thử lại");
      } else if (err instanceof Error) {
        setError(`Lỗi: ${err.message}`);
      } else {
        setError("Lỗi kết nối server, vui lòng thử lại");
      }
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
    setAnalysisTime(null);

    if (annotatedImageUrl) {
      URL.revokeObjectURL(annotatedImageUrl);
    }
  };

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

  // ✅ Server status color
  const getServerStatusColor = () => {
    switch (serverStatus) {
      case "ready":
        return "#32CD32";
      case "warming up":
        return "#FFA500";
      case "error":
        return "#FF4444";
      case "offline":
        return "#888888";
      default:
        return "#888888";
    }
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
        {/* Header with server status */}
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: getServerStatusColor(),
                  animation:
                    serverStatus === "warming up"
                      ? "pulse 1.5s infinite"
                      : "none",
                  "@keyframes pulse": {
                    "0%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                    "100%": { opacity: 1 },
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: "white", fontSize: "0.7rem" }}
              >
                {serverStatus}
              </Typography>
            </Box>
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
                    sx={{ mb: 2 }}
                  >
                    Sử dụng AI để phát hiện nhiều quả xoài tươi hay thối cùng
                    lúc
                  </Typography>

                  {/* ✅ Server status indicator */}
                  <Box sx={{ mb: 3 }}>
                    <Chip
                      icon={<Speed />}
                      label={`Server: ${serverStatus}`}
                      color={serverStatus === "ready" ? "secondary" : "default"}
                      size="small"
                      sx={{ fontSize: "0.75rem" }}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CameraAlt />}
                    onClick={openCamera}
                    disabled={serverStatus === "offline"}
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
                      "&:disabled": {
                        background: "#cccccc",
                      },
                    }}
                  >
                    {serverStatus === "ready"
                      ? "Bắt Đầu Kiểm Tra"
                      : serverStatus === "warming up"
                      ? "Đang khởi động..."
                      : "Server không khả dụng"}
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

          {/* Analysis Results with progress */}
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
                  {isAnalyzing ? (
                    <>
                      <img
                        src={capturedImage!}
                        alt="Captured mango"
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                        }}
                      />
                      {/* ✅ Progress bar */}
                      <LinearProgress
                        sx={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                        }}
                      />
                    </>
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
                        Có thể mất 30-60 giây trên server
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Fade>
          )}

          {/* Results with timing info */}
          {results && results.length > 0 && (
            <Slide direction="up" in timeout={700}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Kết Quả Phân Tích ({results.length} quả)
                    </Typography>
                    {analysisTime && (
                      <Chip
                        icon={<Speed />}
                        label={`${analysisTime}s`}
                        size="small"
                        color="info"
                      />
                    )}
                  </Box>

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
                {error.includes("server") && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" display="block">
                      💡 Mẹo: Server miễn phí có thể chậm lần đầu sử dụng
                    </Typography>
                  </Box>
                )}
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
