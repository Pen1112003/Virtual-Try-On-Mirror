import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, ThumbsUp, Sparkles, AlertCircle, GraduationCap, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkThumbsUp, generateOutfit, guessMajor } from './services/geminiService';
import * as htmlToImage from 'html-to-image';

type AppState = 'initializing' | 'detecting' | 'generating' | 'done' | 'error';

const MAJORS = [
  { id: 'it', name: 'Công Nghệ Thông Tin', prompt: 'Công nghệ thông tin (IT, Software Engineer, smart casual, tech-wear, hacker style)' },
  { id: 'biz', name: 'Quản Trị Kinh Doanh', prompt: 'Quản trị kinh doanh (Business Administration, professional suit, elegant, corporate)' },
  { id: 'design', name: 'Thiết Kế Đồ Họa', prompt: 'Thiết kế đồ họa (Graphic Design, creative, artsy, stylish streetwear, colorful)' },
  { id: 'media', name: 'Truyền Thông', prompt: 'Truyền thông đa phương tiện (Media, trendy, modern, fashionable, influencer style)' },
];

const FloatingHashtag = ({ text, delay, position, rotation }: { text: string, delay: number, position: string, rotation: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 50, rotate: rotation - 20 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotate: rotation }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 15, 
        delay: delay,
      }}
      className={`absolute ${position} z-30 pointer-events-none`}
    >
      <motion.div
        animate={{ 
          y: [0, -8, 0],
          rotate: [rotation, rotation + 2, rotation - 2, rotation]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: delay + 0.5
        }}
        className="bg-white text-[#F26F21] font-black text-sm md:text-xl px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-2 md:border-4 border-[#F26F21] flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
        style={{ transformOrigin: 'bottom center' }}
      >
        {/* Handle part of the sign */}
        <div className="absolute -bottom-10 md:-bottom-14 left-1/2 -translate-x-1/2 w-4 md:w-6 h-10 md:h-14 bg-zinc-200 rounded-b-md md:rounded-b-lg border-2 border-t-0 border-zinc-300 -z-10 shadow-inner"></div>
        <span className="text-blue-700">#</span>{text}
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [appState, setAppState] = useState<AppState>('initializing');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [predictedMajor, setPredictedMajor] = useState(MAJORS[0]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Initialize camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setAppState('detecting');
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setAppState('error');
        setErrorMessage('Could not access the camera. Please ensure permissions are granted.');
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Gesture detection loop
  useEffect(() => {
    let intervalId: number;
    let isChecking = false;

    if (appState === 'detecting') {
      intervalId = window.setInterval(async () => {
        if (isChecking || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState !== 4) return;

        isChecking = true;
        
        // Capture frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Get base64 (without prefix for Gemini)
          const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          
          const hasThumbsUp = await checkThumbsUp(base64Data);
          
          if (hasThumbsUp) {
            clearInterval(intervalId);
            startGenerationProcess(base64Data);
          }
        }
        
        isChecking = false;
      }, 5000); // Check every 5 seconds to avoid rate limiting
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [appState]);

  const startGenerationProcess = async (base64Data: string) => {
    setAppState('generating');
    
    // Guess major
    const majorId = await guessMajor(base64Data);
    const major = MAJORS.find(m => m.id === majorId) || MAJORS[0];
    setPredictedMajor(major);

    // Start a visual countdown/loading state
    const result = await generateOutfit(base64Data, major.prompt);
    
    if (result) {
      setGeneratedImage(result);
      setAppState('done');
    } else {
      setAppState('error');
      setErrorMessage('Failed to generate outfit. Please try again.');
    }
  };

  const resetApp = () => {
    setGeneratedImage(null);
    setAppState('detecting');
    setErrorMessage('');
  };

  const downloadImage = async () => {
    if (!captureRef.current) return;
    
    try {
      setIsDownloading(true);
      const dataUrl = await htmlToImage.toJpeg(captureRef.current, { quality: 0.95 });
      const link = document.createElement('a');
      link.download = `fptu-checkin-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
      setErrorMessage('Failed to download image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans overflow-hidden flex flex-col relative">
      {/* Header */}
      <header className="p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F26F21]/20 flex items-center justify-center border border-[#F26F21]/30">
            <GraduationCap className="w-5 h-5 text-[#F26F21]" />
          </div>
          <h1 className="text-xl font-medium tracking-tight">FPTU Virtual Mirror</h1>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          {appState === 'detecting' && (
            <>
              <ThumbsUp className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-zinc-300">Show thumbs up or</span>
              <button 
                onClick={() => {
                  if (videoRef.current && canvasRef.current) {
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                      startGenerationProcess(base64Data);
                    }
                  }
                }}
                className="ml-2 px-3 py-1 bg-[#F26F21] text-white text-xs font-bold rounded-full hover:bg-[#d95d18] transition-colors"
              >
                Click Here
              </button>
            </>
          )}
          {appState === 'generating' && (
            <>
              <RefreshCw className="w-4 h-4 text-[#F26F21] animate-spin" />
              <span className="text-sm font-medium text-zinc-300">Designing outfit...</span>
            </>
          )}
          {appState === 'done' && (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-zinc-300">Looking good!</span>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-6 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Camera Feed */}
        <div className={`relative rounded-3xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl transition-all duration-700 ease-in-out ${appState === 'done' ? 'absolute bottom-6 right-6 w-40 md:w-64 z-20 opacity-80 hover:opacity-100' : 'w-full max-w-4xl'}`}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover aspect-[4/3] md:aspect-video transform scale-x-[-1]"
            playsInline
            muted
          />
          
          {/* Overlays */}
          <AnimatePresence>
            {appState === 'detecting' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 border-4 border-emerald-500/0 flex items-center justify-center pointer-events-none"
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-dashed border-white/30 rounded-full animate-[spin_10s_linear_infinite]" />
              </motion.div>
            )}
            
            {appState === 'generating' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-[#F26F21]/30 rounded-full" />
                  <div className="w-24 h-24 border-4 border-[#F26F21] rounded-full border-t-transparent animate-spin absolute inset-0" />
                  <Sparkles className="w-8 h-8 text-[#F26F21] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-lg font-medium text-[#F26F21] animate-pulse">Analyzing body & generating outfit...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Generated Result & Check-in Frame */}
        <AnimatePresence>
          {appState === 'done' && generatedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl relative rounded-3xl overflow-hidden bg-black border border-white/20 shadow-2xl flex flex-col z-10"
            >
              {/* Capture Area */}
              <div ref={captureRef} className="relative w-full bg-[#f8f9fa] p-4 md:p-8 pb-28 md:pb-40 overflow-hidden shadow-2xl">
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                  {/* Top Left Orange Blob */}
                  <svg className="absolute -top-20 -left-20 w-96 h-96 text-[#F26F21] opacity-10" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.1,-2.4C97.4,13.2,92,29,82.2,41.7C72.4,54.4,58.2,64,43.2,71.6C28.2,79.2,12.4,84.8,-3.4,89.6C-19.2,94.4,-35,98.4,-48.9,92.5C-62.8,86.6,-74.8,70.8,-82.6,53.8C-90.4,36.8,-94,18.4,-92.4,0.9C-90.8,-16.6,-84,-33.2,-73.5,-46.4C-63,-59.6,-48.8,-69.4,-34.3,-76.1C-19.8,-82.8,-5,-86.4,9.1,-84.8C23.2,-83.2,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
                  </svg>
                  {/* Bottom Right Blue Blob */}
                  <svg className="absolute -bottom-20 -right-20 w-96 h-96 text-blue-600 opacity-10" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.1,-2.4C97.4,13.2,92,29,82.2,41.7C72.4,54.4,58.2,64,43.2,71.6C28.2,79.2,12.4,84.8,-3.4,89.6C-19.2,94.4,-35,98.4,-48.9,92.5C-62.8,86.6,-74.8,70.8,-82.6,53.8C-90.4,36.8,-94,18.4,-92.4,0.9C-90.8,-16.6,-84,-33.2,-73.5,-46.4C-63,-59.6,-48.8,-69.4,-34.3,-76.1C-19.8,-82.8,-5,-86.4,9.1,-84.8C23.2,-83.2,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
                  </svg>
                  {/* FPT Pattern */}
                  <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
                    <pattern id="fpt-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M0 40L40 0H20L0 20M40 40V20L20 40" fill="#F26F21" />
                    </pattern>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#fpt-pattern)" />
                  </svg>
                </div>

                {/* Inner Image Frame */}
                <div className="w-full relative rounded-xl md:rounded-2xl overflow-hidden border-[8px] md:border-[12px] border-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-10 aspect-[4/3] md:aspect-video">
                  <img 
                    src={generatedImage} 
                    alt="Generated Outfit" 
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Frame Branding */}
                <div className="absolute bottom-0 left-0 right-0 h-24 md:h-32 bg-white flex items-center justify-between px-6 md:px-12 z-40 border-t-[8px] border-[#F26F21] shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-[#F26F21] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                      <span className="text-white font-black text-3xl md:text-4xl italic">F</span>
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl md:text-3xl font-black text-zinc-900 tracking-tighter leading-none uppercase">FPT University</h2>
                      <p className="text-xs md:text-sm font-bold text-[#F26F21] tracking-[0.2em] uppercase mt-1">Ho Chi Minh City</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end text-right">
                    <h3 className="text-lg md:text-2xl font-black text-blue-900 uppercase tracking-widest">Experience Day</h3>
                    <div className="bg-[#F26F21] text-white px-5 py-1 md:px-6 md:py-1.5 rounded-full text-sm md:text-lg font-black mt-1 shadow-inner tracking-widest">
                      2026
                    </div>
                  </div>
                </div>

                {/* Floating Hashtags inside the frame */}
                <FloatingHashtag 
                  text="Experience Day 2026" 
                  delay={0.5} 
                  position="top-8 left-4 md:top-12 md:left-8" 
                  rotation={-12} 
                />
                <FloatingHashtag 
                  text="ĐH FPT HCM" 
                  delay={0.8} 
                  position="top-12 right-4 md:top-16 md:right-8" 
                  rotation={15} 
                />
                <FloatingHashtag 
                  text={predictedMajor.name} 
                  delay={1.1} 
                  position="bottom-32 left-6 md:bottom-40 md:left-12" 
                  rotation={-6} 
                />
              </div>
              
              {/* Controls Overlay (Not captured) */}
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-center gap-4">
                <button 
                  onClick={downloadImage}
                  disabled={isDownloading}
                  className="px-6 md:px-8 py-3 md:py-4 bg-[#F26F21] text-white rounded-full font-semibold flex items-center gap-2 hover:bg-[#d95d18] transition-colors shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isDownloading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  Tải Ảnh Về
                </button>
                <button 
                  onClick={resetApp}
                  className="px-6 md:px-8 py-3 md:py-4 bg-white text-black rounded-full font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg hover:scale-105 active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  Thử Lại
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {appState === 'error' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-4 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl z-50"
            >
              <AlertCircle className="w-6 h-6 text-red-400" />
              <p className="font-medium">{errorMessage}</p>
              <button 
                onClick={resetApp}
                className="ml-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-colors text-sm font-semibold"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
