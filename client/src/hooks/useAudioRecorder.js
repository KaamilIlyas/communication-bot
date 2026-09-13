import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeWAV } from '../utils/wavEncoder';

export function useAudioRecorder({ onAudioReady, onNoSpeech, silenceTimeoutMs = 2000, autoSendOnSilence = true }) {
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
  const initialSilenceTimerRef = useRef(null);
  const isSpeechDetectedRef = useRef(false);
  const speechFramesCountRef = useRef(0);
  const onAudioReadyRef = useRef(onAudioReady);
  const onNoSpeechRef = useRef(onNoSpeech);
  const autoSendRef = useRef(autoSendOnSilence);
  const silenceTimeoutRef = useRef(silenceTimeoutMs);

  useEffect(() => {
    onAudioReadyRef.current = onAudioReady;
  }, [onAudioReady]);

  useEffect(() => {
    onNoSpeechRef.current = onNoSpeech;
  }, [onNoSpeech]);

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

  const stopRecording = useCallback(({ reason = 'user_stop' } = {}) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }

    const hadSpeech = isSpeechDetectedRef.current;
    const buffers = audioBuffersRef.current;

    // Reset recording internal states
    audioBuffersRef.current = [];
    isSpeechDetectedRef.current = false;
    speechFramesCountRef.current = 0;

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

    // If silence was detected and no real speech occurred -> stop listening without sending audio
    if (!hadSpeech || reason === 'no_speech') {
      console.log('[AudioRecorder] Silence detected without speech. Stopped listening.');
      if (onNoSpeechRef.current) {
        onNoSpeechRef.current();
      }
      return;
    }

    // Process recorded audio buffers into WAV only when real speech was detected
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

      // 4096 samples buffer (~92ms per process tick at 44.1kHz)
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;
      audioBuffersRef.current = [];
      isSpeechDetectedRef.current = false;
      speechFramesCountRef.current = 0;

      // Start initial silence countdown: if user does not speak within 4.5s, stop listening!
      if (autoSendRef.current) {
        if (initialSilenceTimerRef.current) clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = setTimeout(() => {
          if (!isSpeechDetectedRef.current) {
            console.log('[VAD] No speech detected within 4.5s. Stopping listening.');
            stopRecording({ reason: 'no_speech' });
          }
        }, 4500);
      }

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
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

        const speechThreshold = 0.028; // Robust threshold above typical mic noise floor
        if (rms > speechThreshold) {
          speechFramesCountRef.current++;
          // Require at least 3 consecutive frames (~270ms) to confirm genuine human speech
          if (speechFramesCountRef.current >= 3) {
            setIsSpeaking(true);
            isSpeechDetectedRef.current = true;
            // Clear initial silence timeout since user is speaking
            if (initialSilenceTimerRef.current) {
              clearTimeout(initialSilenceTimerRef.current);
              initialSilenceTimerRef.current = null;
            }
            // Clear post-speech silence timer while speech is continuous
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        } else {
          speechFramesCountRef.current = 0;
          setIsSpeaking(false);
          // Only start trailing silence countdown if user actually spoke previously
          if (isSpeechDetectedRef.current && autoSendRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log(`[VAD] ${silenceTimeoutRef.current}ms of silence after speech detected. Sending speech to AI...`);
              stopRecording({ reason: 'speech_completed' });
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
