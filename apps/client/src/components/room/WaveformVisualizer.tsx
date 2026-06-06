"use client";

import { useEffect, useRef } from "react";
import { audioEngine } from "../../utils/audio";
import { useGlobalStore } from "../../store/globalStore";

export default function WaveformVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const isPlaying = useGlobalStore((state) => state.isPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions with device pixel ratio scaling
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    const analyser = audioEngine.getAnalyser();
    let bufferLength = analyser ? analyser.frequencyBinCount : 128;
    let dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      
      ctx.clearRect(0, 0, width, height);

      const activeAnalyser = audioEngine.getAnalyser();
      if (activeAnalyser && isPlaying) {
        activeAnalyser.getByteTimeDomainData(dataArray);
      } else {
        // Mock idle wave data using sine waves
        const now = Date.now() * 0.004;
        for (let i = 0; i < bufferLength; i++) {
          const progress = i / bufferLength;
          const sine = Math.sin(progress * Math.PI * 4 + now) * Math.sin(progress * Math.PI);
          dataArray[i] = 128 + sine * 12; // Moderate amplitude idle wave
        }
      }

      ctx.lineWidth = 3;
      
      // Create gradient matching the premium brand to accent tokens
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#a78bfa"); // brand-light
      gradient.addColorStop(0.5, "#ec4899"); // pink-500
      gradient.addColorStop(1, "#f43f5e"); // accent (rose)
      ctx.strokeStyle = gradient;

      // Glow effect
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(167, 139, 250, 0.4)";
      
      ctx.beginPath();
      
      const sliceWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      // Reset shadow for performance on other elements
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className="w-full h-24 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-2 overflow-hidden backdrop-blur-sm">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
