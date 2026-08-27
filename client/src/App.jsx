import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ConversationView } from './components/ConversationView';
import { PracticeCard } from './components/PracticeCard';
import { Controls } from './components/Controls';
import { SettingsModal } from './components/SettingsModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioPlayer } from './hooks/useAudioPlayer';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [corrections, setCorrections] = useState([]);
  const [practiceMode, setPracticeMode] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [silenceTimeout, setSilenceTimeout] = useState(3000);
  const [isCallActive, setIsCallActive] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [sttStatus, setSttStatus] = useState('idle'); // 'idle' | 'transcribing'
  const [llmStatus, setLlmStatus] = useState('idle'); // 'idle' | 'streaming'
  const [errorBanner, setErrorBanner] = useState(null);

  const isCallActiveRef = useRef(false);
  const llmDoneRef = useRef(false);
  const rearmTimerRef = useRef(null);

  // Audio recording callback (WAV blob -> Base64 -> WS)
  const handleAudioReady = useCallback((audioBlob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result.split(',')[1];
      console.log(`[App] Sending ${audioBlob.size} bytes (16kHz WAV) over WebSocket...`);
      setSttStatus('transcribing');
      llmDoneRef.current = false;

      sendMessage({
        type: 'audio_data',
        audio: base64Audio,
        format: 'wav',
        isPracticeMode: practiceMode,
        voice: selectedVoice,
        speed: speed
      });
    };
    reader.readAsDataURL(audioBlob);
  }, [practiceMode, selectedVoice, speed]);

  const {
    isRecording,
    analyserNode: micAnalyser,
    error: micError,
    startRecording,
    stopRecording
  } = useAudioRecorder({
    onAudioReady: handleAudioReady,
    silenceTimeoutMs: silenceTimeout,
    autoSendOnSilence: autoSend
  });

  // Called when all queued audio chunks have completely finished playing
  const handlePlaybackEnded = useCallback(() => {
    console.log('[AudioPlayer] Finished speaking all audio chunks.');
    if (isCallActiveRef.current && llmDoneRef.current) {
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
      console.log('[AutoCall] Conversation turn complete. Re-arming microphone in 600ms...');
      rearmTimerRef.current = setTimeout(() => {
        if (isCallActiveRef.current) {
          startRecording();
        }
      }, 600);
    }
  }, [startRecording]);

  const { isPlaying, enqueueAudio, stopPlayback, analyserNode: playerAnalyser } = useAudioPlayer({
    onPlaybackEnded: handlePlaybackEnded
  });

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected': {
        if (data.voices && data.voices.length > 0) {
          setAvailableVoices(data.voices);
        }
        if (data.defaultVoice) {
          setSelectedVoice(data.defaultVoice);
        }
        break;
      }

      case 'stt_start': {
        setSttStatus('transcribing');
        setErrorBanner(null);
        break;
      }

      case 'transcription': {
        setSttStatus('idle');
        const userMsg = {
          role: 'user',
          content: data.text,
          timestamp: Date.now()
        };
        setMessages((prev) => [...prev, userMsg]);
        break;
      }

      case 'stt_empty': {
        setSttStatus('idle');
        setErrorBanner(data.message || 'No speech detected.');
        setTimeout(() => setErrorBanner(null), 4000);
        // If in call mode, re-arm microphone
        if (isCallActiveRef.current) {
          setTimeout(() => {
            if (isCallActiveRef.current) startRecording();
          }, 800);
        }
        break;
      }

      case 'llm_start': {
        setLlmStatus('streaming');
        setStreamingText('');
        llmDoneRef.current = false;
        break;
      }

      case 'llm_chunk': {
        setStreamingText((prev) => {
          const next = prev + data.token;
          return next.replace(/\[CORRECTION:.*?\]/gis, '');
        });
        break;
      }

      case 'audio_chunk': {
        if (data.audio) {
          enqueueAudio(data.audio);
        }
        break;
      }

      case 'llm_done': {
        setLlmStatus('idle');
        setStreamingText('');
        llmDoneRef.current = true;

        const assistantMsg = {
          role: 'assistant',
          content: data.fullText,
          spokenText: data.spokenText,
          correction: data.correction,
          timestamp: Date.now()
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (data.correction) {
          setCorrections((prev) => [data.correction, ...prev]);
        }
        break;
      }

      case 'interrupted': {
        setLlmStatus('idle');
        setStreamingText('');
        stopPlayback();
        break;
      }

      case 'history_cleared': {
        setMessages([]);
        setCorrections([]);
        setStreamingText('');
        stopPlayback();
        break;
      }

      case 'error': {
        setSttStatus('idle');
        setLlmStatus('idle');
        setErrorBanner(data.message || 'Error occurred');
        setTimeout(() => setErrorBanner(null), 5000);
        break;
      }

      default:
        break;
    }
  }, [enqueueAudio, stopPlayback, startRecording]);

  const { status: wsStatus, error: wsError, sendMessage } = useWebSocket({
    onMessage: handleWsMessage
  });

  useEffect(() => {
    if (wsStatus === 'connected') {
      setErrorBanner(null);
    } else if (wsError) {
      // setErrorBanner(`WebSocket connection error: ${wsError}`);
      console.log(wsError);
    }
  }, [wsStatus, wsError]);

  useEffect(() => {
    if (micError) {
      setErrorBanner(micError);
    }
  }, [micError]);

  const handleToggleCall = () => {
    if (isRecording || isCallActive) {
      // User manually stopped the call
      isCallActiveRef.current = false;
      setIsCallActive(false);
      stopRecording();
      stopPlayback();
    } else {
      // User started call
      isCallActiveRef.current = true;
      setIsCallActive(true);
      startRecording();
    }
  };

  const handleInterrupt = () => {
    isCallActiveRef.current = false;
    setIsCallActive(false);
    stopPlayback();
    stopRecording();
    sendMessage({ type: 'interrupt' });
  };

  const handleClearHistory = () => {
    isCallActiveRef.current = false;
    setIsCallActive(false);
    stopPlayback();
    stopRecording();
    sendMessage({ type: 'clear_history' });
  };

  const handleTogglePracticeMode = () => {
    const nextMode = !practiceMode;
    setPracticeMode(nextMode);
    sendMessage({
      type: 'set_settings',
      practiceMode: nextMode
    });
  };

  const handleSendText = (text) => {
    if (!text.trim()) return;
    llmDoneRef.current = false;
    sendMessage({
      type: 'text_message',
      text: text.trim(),
      isPracticeMode: practiceMode,
      voice: selectedVoice,
      speed: speed
    });
  };

  const handleReplayMessage = (text) => {
    if (!text) return;
    handleSendText(`Please repeat: ${text}`);
  };

  const currentVoiceObj = availableVoices.find(v => v.id === selectedVoice);
  const voiceName = currentVoiceObj ? currentVoiceObj.name : '💖 Heart (Ultra-Realistic)';

  return (
    <div className="app-container">
      <Header
        wsStatus={wsStatus}
        practiceMode={practiceMode}
        onTogglePracticeMode={handleTogglePracticeMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        voiceName={voiceName}
      />

      {errorBanner && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: 'var(--accent-rose)',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {errorBanner}</span>
          <button 
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => setErrorBanner(null)}
          >
            ✕
          </button>
        </div>
      )}

      <main className="main-grid">
        <section className="conversation-panel">
          <ConversationView
            messages={messages}
            streamingText={streamingText}
            onSelectStarter={handleSendText}
            onReplayMessage={handleReplayMessage}
          />

          <Visualizer
            micAnalyser={micAnalyser}
            playerAnalyser={playerAnalyser}
            isRecording={isRecording}
            isPlaying={isPlaying}
            sttStatus={sttStatus}
            llmStatus={llmStatus}
          />

          <Controls
            isRecording={isRecording}
            isPlaying={isPlaying}
            autoSend={autoSend}
            onToggleAutoSend={() => setAutoSend(!autoSend)}
            onToggleRecord={handleToggleCall}
            onInterrupt={handleInterrupt}
            onSendText={handleSendText}
            onClearHistory={handleClearHistory}
          />
        </section>

        <PracticeCard
          corrections={corrections}
          messageCount={messages.filter(m => m.role === 'user').length}
          practiceMode={practiceMode}
          selectedVoiceName={voiceName}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        voices={availableVoices}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          sendMessage({ type: 'set_settings', voice: v });
        }}
        speed={speed}
        onChangeSpeed={(s) => {
          setSpeed(s);
          sendMessage({ type: 'set_settings', speed: s });
        }}
        silenceTimeout={silenceTimeout}
        onChangeSilenceTimeout={setSilenceTimeout}
      />
    </div>
  );
}
