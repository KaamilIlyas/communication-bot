import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer({ onPlaybackEnded } = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  
  // Pre-decoded AudioBuffers ready for instant 0ms playback
  const decodedQueueRef = useRef([]);
  // Raw incoming audio chunks awaiting decode
  const rawQueueRef = useRef([]);
  const currentSourceRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isDecodingRef = useRef(false);

  const onPlaybackEndedRef = useRef(onPlaybackEnded);

  useEffect(() => {
    onPlaybackEndedRef.current = onPlaybackEnded;
  }, [onPlaybackEnded]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playNextChunk = useCallback(() => {
    if (decodedQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentSourceRef.current = null;
      if (rawQueueRef.current.length === 0 && onPlaybackEndedRef.current) {
        onPlaybackEndedRef.current();
      }
      return;
    }

    const audioCtx = getAudioContext();
    const audioBuffer = decodedQueueRef.current.shift();
    if (!audioBuffer) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyserRef.current || audioCtx.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      playNextChunk();
    };

    source.start(0);
  }, [getAudioContext]);

  // Decode incoming raw chunks immediately in background so they are warm & ready in memory
  const processRawQueue = useCallback(async () => {
    if (isDecodingRef.current || rawQueueRef.current.length === 0) return;
    isDecodingRef.current = true;

    while (rawQueueRef.current.length > 0) {
      const raw = rawQueueRef.current.shift();
      try {
        const audioCtx = getAudioContext();
        let arrayBuffer;

        if (typeof raw === 'string') {
          const binaryString = window.atob(raw);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else if (raw instanceof ArrayBuffer) {
          arrayBuffer = raw;
        } else {
          continue;
        }

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        decodedQueueRef.current.push(audioBuffer);

        // If player is idle, immediately kick off playback
        if (!isPlayingRef.current) {
          playNextChunk();
        }
      } catch (err) {
        console.error('[AudioPlayer] Error decoding audio chunk:', err);
      }
    }

    isDecodingRef.current = false;
  }, [getAudioContext, playNextChunk]);

  const enqueueAudio = useCallback((audioData) => {
    if (!audioData) return;
    rawQueueRef.current.push(audioData);
    processRawQueue();
  }, [processRawQueue]);

  const stopPlayback = useCallback(() => {
    rawQueueRef.current = [];
    decodedQueueRef.current = [];
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {}
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopPlayback]);

  return {
    isPlaying,
    enqueueAudio,
    stopPlayback,
    analyserNode: analyserRef.current,
    getAudioContext
  };
}
