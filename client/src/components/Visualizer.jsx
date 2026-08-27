import React, { useRef, useEffect } from 'react';
import { Radio, Volume2, Mic, Cpu } from 'lucide-react';

export function Visualizer({ 
  micAnalyser, 
  playerAnalyser, 
  isRecording, 
  isPlaying, 
  sttStatus, 
  llmStatus 
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let activeAnalyser = null;
      let colorMode = 'idle';

      if (isRecording && micAnalyser) {
        activeAnalyser = micAnalyser;
        colorMode = 'recording';
      } else if (isPlaying && playerAnalyser) {
        activeAnalyser = playerAnalyser;
        colorMode = 'speaking';
      }

      if (activeAnalyser) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.85;

          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          if (colorMode === 'recording') {
            gradient.addColorStop(0, '#f43f5e');
            gradient.addColorStop(1, '#6366f1');
          } else {
            gradient.addColorStop(0, '#06b6d4');
            gradient.addColorStop(1, '#10b981');
          }

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight - 4, barWidth - 2, barHeight + 4, 3);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // Idle gentle animated ambient wave
        const time = Date.now() * 0.003;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.04 + time) * 4 * Math.sin(x / width * Math.PI);
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [micAnalyser, playerAnalyser, isRecording, isPlaying]);

  // Determine user friendly state label
  let stateIcon = <Radio size={14} color="var(--accent-primary)" />;
  let stateText = 'Tap microphone to start speaking';
  let stateColor = 'var(--text-muted)';

  if (isRecording) {
    stateIcon = <Mic size={14} color="var(--accent-rose)" className="animate-pulse" />;
    stateText = 'Listening to you... Speak in English';
    stateColor = 'var(--accent-rose)';
  } else if (sttStatus === 'transcribing') {
    stateIcon = <Cpu size={14} color="var(--accent-cyan)" />;
    stateText = 'Transcribing with Whisper...';
    stateColor = 'var(--accent-cyan)';
  } else if (llmStatus === 'streaming') {
    stateIcon = <Cpu size={14} color="var(--accent-primary)" />;
    stateText = 'Gemma 3 (4B) is generating response...';
    stateColor = 'var(--accent-primary)';
  } else if (isPlaying) {
    stateIcon = <Volume2 size={14} color="var(--accent-emerald)" />;
    stateText = 'AI speaking...';
    stateColor = 'var(--accent-emerald)';
  }

  return (
    <div className="visualizer-card">
      <canvas 
        ref={canvasRef} 
        width={700} 
        height={60} 
        className="visualizer-canvas"
      />
      <div className="live-state-label" style={{ color: stateColor }}>
        {stateIcon}
        <span>{stateText}</span>
      </div>
    </div>
  );
}
