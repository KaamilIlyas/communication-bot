import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeWAV } from '../utils/wavEncoder';

export function useAudioRecorder({ onAudioReady, silenceTimeoutMs = 2000, autoSendOnSilence = true }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const processorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const audioBuffersRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const isSpeechDetectedRef = useRef(false);
  const onAudioReadyRef = useRef(onAudioReady);
  const autoSendRef = useRef(autoSendOnSilence);
  const silenceTimeoutRef = useRef(silenceTimeoutMs);

  useEffect(() => {
    onAudioReadyRef.current = onAudioReady;
  }, [onAudioReady]);

  useEffect(() => {
    autoSendRef.current = autoSendOnSilence;
  }, [autoSendOnSilence]);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeoutMs;
  }, [silenceTimeoutMs]);

  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setPermissionGranted(true);
      return stream;
    } catch (err) {
      console.error('Microphone permission error:', err);
      setError(err.name === 'NotAllowedError' 
        ? 'Microphone access denied. Please enable mic access in your browser settings.' 
        : `Microphone error: ${err.message}`);
      setPermissionGranted(false);
      return null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Process recorded audio buffers into WAV
    const buffers = audioBuffersRef.current;
    if (buffers.length > 0 && audioContextRef.current) {
      let totalSamples = 0;
      for (const b of buffers) {
        totalSamples += b.length;
      }
      
      const mergedSamples = new Float32Array(totalSamples);
      let offset = 0;
      for (const b of buffers) {
        mergedSamples.set(b, offset);
        offset += b.length;
      }

      const inputSampleRate = audioContextRef.current.sampleRate || 44100;
      // Encode to 16kHz Mono 16-bit WAV
      const wavBlob = encodeWAV(mergedSamples, inputSampleRate, 16000);
      console.log(`[AudioRecorder] Captured ${totalSamples} samples (${(totalSamples / inputSampleRate).toFixed(2)}s). WAV Blob size: ${wavBlob.size} bytes.`);

      if (wavBlob.size > 200 && onAudioReadyRef.current) {
        onAudioReadyRef.current(wavBlob);
      }
    }

    // Reset recording state
    audioBuffersRef.current = [];
    isSpeechDetectedRef.current = false;

    // Disconnect Web Audio processor nodes
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await requestPermission();
      if (!stream) return;
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      source.connect(analyser);

      // Create ScriptProcessor to capture raw Float32 audio samples
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;
      audioBuffersRef.current = [];
      isSpeechDetectedRef.current = false;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Clone input data slice
        const clone = new Float32Array(inputData.length);
        clone.set(inputData);
        audioBuffersRef.current.push(clone);

        // Calculate RMS audio energy
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        const normalizedVolume = Math.min(1, rms * 8);
        setAudioLevel(normalizedVolume);

        const speechThreshold = 0.025; // Reliable speech threshold
        if (rms > speechThreshold) {
          setIsSpeaking(true);
          isSpeechDetectedRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          setIsSpeaking(false);
          // If speech was detected and autoSend is enabled -> start 3s silence countdown
          if (isSpeechDetectedRef.current && autoSendRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('[VAD] 3 seconds of silence detected. Sending speech to AI...');
              stopRecording();
            }, silenceTimeoutRef.current);
          }
        }
      };

      source.connect(processor);
      // Connect processor to destination to keep audio flow alive (muted volume via zero gain)
      const silenceGain = audioCtx.createGain();
      silenceGain.gain.value = 0;
      processor.connect(silenceGain);
      silenceGain.connect(audioCtx.destination);

      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      setError(`Failed to start recording: ${err.message}`);
      setIsRecording(false);
    }
  }, [requestPermission, stopRecording]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    isSpeaking,
    audioLevel,
    analyserNode: analyserRef.current,
    permissionGranted,
    error,
    requestPermission,
    startRecording,
    stopRecording
  };
}
