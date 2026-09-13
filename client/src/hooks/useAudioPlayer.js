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

  // Pre-load and cache browser voices to prevent robotic fallback
  const browserVoicesRef = useRef([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        browserVoicesRef.current = v;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speakText = useCallback((text, { speed = 1.0, voice = 'af_sarah', onEnd } = {}) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/\[CORRECTION:.*?\]/gi, '')
      .replace(/[*#`_~]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = Math.max(0.7, Math.min(1.4, speed));

    const voices = browserVoicesRef.current.length > 0 
      ? browserVoicesRef.current 
      : window.speechSynthesis.getVoices();

    const isBritish = voice.startsWith('b') || voice.includes('george') || voice.includes('emma');
    const isMale = voice.startsWith('am_') || voice.startsWith('bm_') || voice.includes('adam') || voice.includes('michael') || voice.includes('george');

    let matchedVoice = null;

    if (isBritish) {
      utterance.lang = 'en-GB';
      matchedVoice = voices.find(v => v.lang === 'en-GB' && (
        isMale ? (v.name.includes('George') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('Male'))
               : (v.name.includes('Emma') || v.name.includes('Sonia') || v.name.includes('Stephanie') || v.name.includes('Female'))
      )) || voices.find(v => v.lang.startsWith('en-GB'));
    } else {
      utterance.lang = 'en-US';
      matchedVoice = voices.find(v => v.lang.startsWith('en') && (
        isMale ? (v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Alex') || v.name.includes('Male'))
               : (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural'))
      ));
    }

    if (!matchedVoice) {
      matchedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')))
                  || voices.find(v => v.lang.startsWith('en'));
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Persona-specific natural pitch tuning
    if (voice === 'am_michael') utterance.pitch = 0.82;
    else if (voice === 'af_bella') utterance.pitch = 1.12;
    else if (voice === 'af_heart') utterance.pitch = 1.05;
    else if (voice === 'am_adam') utterance.pitch = 0.95;
    else utterance.pitch = 1.0;

    isPlayingRef.current = true;
    setIsPlaying(true);

    utterance.onend = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (onEnd) onEnd();
      else if (onPlaybackEndedRef.current) onPlaybackEndedRef.current();
    };

    utterance.onerror = (e) => {
      console.warn('[SpeechSynthesis] error:', e);
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (onEnd) onEnd();
      else if (onPlaybackEndedRef.current) onPlaybackEndedRef.current();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopPlayback = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
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
    speakText,
    stopPlayback,
    analyserNode: analyserRef.current,
    getAudioContext
  };
}
