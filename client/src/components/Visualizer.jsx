import React, { useRef, useEffect } from 'react';
import { Radio, Volume2, Mic, Sparkles, CircleDot } from 'lucide-react';

export function Visualizer({ 
  micAnalyser, 
  playerAnalyser, 
  isRecording, 
  isPlaying, 
  sttStatus, 
  llmStatus 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(rect.width, 240);
      const targetHeight = 44;

      if (canvas.width !== targetWidth * dpr || canvas.height !== targetHeight * dpr) {
        canvas.width = targetWidth * dpr;
        canvas.height = targetHeight * dpr;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      let activeAnalyser = null;
      let mode = 'idle';

      if (isRecording && micAnalyser) {
        activeAnalyser = micAnalyser;
        mode = 'recording';
      } else if (isPlaying && playerAnalyser) {
        activeAnalyser = playerAnalyser;
        mode = 'speaking';
      }

      if (activeAnalyser) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(dataArray);

        // Render clean symmetric rounded sound bars
        const barCount = Math.min(Math.floor(width / 7), 48);
        const barWidth = 3;
        const totalBarWidth = barCount * 7;
        const startX = (width - totalBarWidth) / 2;
        const step = Math.floor(bufferLength / barCount) || 1;

        for (let i = 0; i < barCount; i++) {
          const rawVal = dataArray[i * step] || 0;
          const normalized = rawVal / 255;
          const barHeight = Math.max(normalized * (height * 0.78), 3);
          const x = startX + i * 7;
          const y = (height - barHeight) / 2;

          if (mode === 'recording') {
            ctx.fillStyle = i % 2 === 0 ? '#f43f5e' : '#fb7185';
          } else {
            ctx.fillStyle = i % 2 === 0 ? '#6366f1' : '#818cf8';
          }

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
      } else {
        // Idle state: Subtle breathing ambient sine line
        const time = Date.now() * 0.002;
        ctx.beginPath();
        const midY = height / 2;
        ctx.moveTo(0, midY);

        for (let x = 0; x < width; x += 3) {
          const envelope = Math.sin((x / width) * Math.PI);
          const y = midY + Math.sin(x * 0.03 + time) * 3 * envelope;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [micAnalyser, playerAnalyser, isRecording, isPlaying]);

  // Determine user friendly status
  let stateIcon = <CircleDot size={13} color="var(--text-muted)" />;
  let stateText = 'Tap mic or press to speak';
  let stateColor = 'var(--text-muted)';

  if (isRecording) {
    stateIcon = <Mic size={13} color="var(--accent-rose)" />;
    stateText = 'Listening...';
    stateColor = 'var(--accent-rose)';
  } else if (sttStatus === 'transcribing') {
    stateIcon = <Sparkles size={13} color="var(--accent-sky)" />;
    stateText = 'Processing speech...';
    stateColor = 'var(--accent-sky)';
  } else if (llmStatus === 'streaming') {
    stateIcon = <Sparkles size={13} color="var(--primary)" />;
    stateText = 'Thinking...';
    stateColor = 'var(--primary)';
  } else if (isPlaying) {
    stateIcon = <Volume2 size={13} color="var(--accent-emerald)" />;
    stateText = 'Speaking...';
    stateColor = 'var(--accent-emerald)';
  }

  return (
    <div className="visualizer-card" ref={containerRef}>
      <canvas 
        ref={canvasRef} 
        className="visualizer-canvas"
      />
      <div className="live-state-pill" style={{ color: stateColor }}>
        {stateIcon}
        <span>{stateText}</span>
      </div>
    </div>
  );
}
