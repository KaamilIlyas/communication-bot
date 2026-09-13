import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ConversationView } from './components/ConversationView';
import { PracticeCard } from './components/PracticeCard';
import { Controls } from './components/Controls';
import { SettingsModal } from './components/SettingsModal';
import { ModeModal } from './components/ModeModal';
import { QuotaLimitModal } from './components/QuotaLimitModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioPlayer } from './hooks/useAudioPlayer';

const DEFAULT_VOICES = [
  { id: 'af_sarah', name: 'Sarah (Studio Voice)', gender: 'Female' },
  { id: 'af_heart', name: 'Heart (Warm & Natural)', gender: 'Female' },
  { id: 'am_adam', name: 'Adam (Conversational)', gender: 'Male' },
  { id: 'af_bella', name: 'Bella (Expressive)', gender: 'Female' },
  { id: 'bm_george', name: 'George (British RP)', gender: 'Male' },
  { id: 'bf_emma', name: 'Emma (British BBC)', gender: 'Female' },
  { id: 'am_michael', name: 'Michael (Deep Voice)', gender: 'Male' }
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  
  // 5 Operational Modes
  const [mode, setMode] = useState('casual'); // 'casual' | 'interview' | 'ielts' | 'workplace' | 'debate'
  const [modeScenarios, setModeScenarios] = useState({
    interview: 'Full-Stack MERN Developer',
    ielts: 'Full IELTS Speaking Test (Parts 1-3)',
    workplace: 'Salary & Promotion Negotiation',
    debate: 'AI & Automation vs Human Software Engineers'
  });
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);

  const [autoSend, setAutoSend] = useState(true);
  const [silenceTimeout, setSilenceTimeout] = useState(() => {
    const saved = localStorage.getItem('silence_timeout');
    return saved ? parseInt(saved, 10) : 2000;
  });
  const [isCallActive, setIsCallActive] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('selected_voice') || 'af_sarah');
  const [availableVoices, setAvailableVoices] = useState(DEFAULT_VOICES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem('llm_provider') || 'openrouter');
  const [openrouterKey, setOpenrouterKey] = useState(() => localStorage.getItem('openrouter_api_key') || '');
  const [ollamaModel, setOllamaModel] = useState('gemma3:4b');

  const [sttStatus, setSttStatus] = useState('idle');
  const [llmStatus, setLlmStatus] = useState('idle');
  const [errorBanner, setErrorBanner] = useState(null);

  const isCallActiveRef = useRef(false);
  const llmDoneRef = useRef(false);
  const rearmTimerRef = useRef(null);
  const pendingResponseRef = useRef(null);

  const currentActiveScenario = modeScenarios[mode] || '';

  const wsStatusRef = useRef('disconnected');
  const sendMessageRef = useRef(null);
  const speakTextRef = useRef(null);
  const startRecordingRef = useRef(null);
  const handleAudioReadyRef = useRef(null);
  const enqueueAudioRef = useRef(null);
  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  // Called when all queued audio chunks have completely finished playing
  const handlePlaybackEnded = useCallback(() => {
    if (pendingResponseRef.current) {
      const resp = pendingResponseRef.current;
      pendingResponseRef.current = null;
      setStreamingText('');

      const assistantMsg = {
        role: 'assistant',
        content: resp.fullText,
        spokenText: resp.spokenText,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, assistantMsg]);
    }

    if (isCallActiveRef.current && llmDoneRef.current) {
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
      rearmTimerRef.current = setTimeout(() => {
        if (isCallActiveRef.current && startRecordingRef.current) {
          startRecordingRef.current();
        }
      }, 600);
    }
  }, []);

  const { isPlaying, enqueueAudio, speakText, stopPlayback, analyserNode: playerAnalyser } = useAudioPlayer({
    onPlaybackEnded: handlePlaybackEnded
  });

  useEffect(() => {
    speakTextRef.current = speakText;
    enqueueAudioRef.current = enqueueAudio;
  }, [speakText, enqueueAudio]);

  const {
    isRecording,
    analyserNode: micAnalyser,
    error: micError,
    startRecording,
    stopRecording
  } = useAudioRecorder({
    onAudioReady: (blob) => {
      if (handleAudioReadyRef.current) {
        handleAudioReadyRef.current(blob);
      }
    },
    onNoSpeech: () => {
      console.log('[App] Silence detected without speech. Stopping listening.');
      setIsCallActive(false);
      isCallActiveRef.current = false;
      setSttStatus('idle');
    },
    silenceTimeoutMs: silenceTimeout
  });

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  // Serverless HTTP turn (used when deployed on Vercel or disconnected from local WS)
  const handleServerlessTurn = useCallback(async (userSpeechText) => {
    setStreamingText('');
    setLlmStatus('thinking');

    const userMsg = {
      role: 'user',
      content: userSpeechText,
      timestamp: Date.now()
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const conversationHistory = updatedMessages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          mode,
          role: modeScenarios.interview,
          scenario: modeScenarios[mode] || '',
          customApiKey: openrouterKey || undefined
        })
      });

      if (!chatRes.ok) {
        const errJson = await chatRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Chat request failed (${chatRes.status})`);
      }

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let fullAssistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim().length > 0);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.token) {
                fullAssistantText += parsed.token;
                setStreamingText(fullAssistantText);
              }
            } catch (e) {}
          }
        }
      }

      setLlmStatus('idle');
      setStreamingText('');
      llmDoneRef.current = true;

      const assistantMsg = {
        role: 'assistant',
        content: fullAssistantText,
        spokenText: fullAssistantText,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // 1. Synthesize via /api/tts using Azure Edge Neural Voices
      let playedNeuralAudio = false;
      try {
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullAssistantText,
            voice: selectedVoiceRef.current,
            speed
          })
        });

        if (ttsRes.ok) {
          const audioBuffer = await ttsRes.arrayBuffer();
          if (enqueueAudioRef.current) {
            enqueueAudioRef.current(audioBuffer);
            playedNeuralAudio = true;
          }
        }
      } catch (ttsErr) {
        console.warn('[Serverless TTS] Neural TTS request error, falling back to speech synthesis:', ttsErr);
      }

      // 2. Fallback to enhanced Web Speech API if neural TTS failed
      if (!playedNeuralAudio && speakTextRef.current) {
        speakTextRef.current(fullAssistantText, {
          speed,
          voice: selectedVoiceRef.current,
          onEnd: () => {
            if (isCallActiveRef.current && startRecordingRef.current) {
              setTimeout(() => {
                if (isCallActiveRef.current && startRecordingRef.current) {
                  startRecordingRef.current();
                }
              }, 600);
            }
          }
        });
      }
    } catch (err) {
      console.error('[Serverless Turn] error:', err);
      setLlmStatus('idle');
      setErrorBanner(err.message);
      setTimeout(() => setErrorBanner(null), 6000);
    }
  }, [messages, mode, modeScenarios, openrouterKey, speed]);

  // Audio recording callback (WAV blob -> Base64 -> WS or Vercel Serverless HTTP)
  const handleAudioReady = useCallback(async (audioBlob) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result.split(',')[1];
      setSttStatus('transcribing');
      llmDoneRef.current = false;

      if (wsStatusRef.current === 'connected' && sendMessageRef.current) {
        sendMessageRef.current({
          type: 'audio_data',
          audio: base64Audio,
          format: 'wav',
          mode,
          role: modeScenarios.interview,
          scenario: modeScenarios[mode] || '',
          voice: selectedVoice,
          speed: speed
        });
      } else {
        // Serverless HTTP Mode on Vercel
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio, format: 'wav' })
          });

          const data = await res.json();
          setSttStatus('idle');

          if (!res.ok || !data.text || !data.text.trim()) {
            if (data.error) setErrorBanner(data.error);
            else setErrorBanner('No speech detected.');
            setTimeout(() => setErrorBanner(null), 3000);
            setIsCallActive(false);
            isCallActiveRef.current = false;
            return;
          }

          await handleServerlessTurn(data.text.trim());
        } catch (sttErr) {
          setSttStatus('idle');
          setErrorBanner(`Transcription failed: ${sttErr.message}`);
          setTimeout(() => setErrorBanner(null), 5000);
        }
      }
    };
    reader.readAsDataURL(audioBlob);
  }, [mode, modeScenarios, selectedVoice, speed, handleServerlessTurn]);

  useEffect(() => {
    handleAudioReadyRef.current = handleAudioReady;
  }, [handleAudioReady]);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected': {
        if (data.voices && data.voices.length > 0) {
          setAvailableVoices(data.voices);
        }
        if (data.defaultVoice) {
          const savedVoice = localStorage.getItem('selected_voice');
          if (!savedVoice) {
            setSelectedVoice(data.defaultVoice);
          }
        }
        if (data.mode) {
          setMode(data.mode);
        }
        if (data.ollamaModel) {
          setOllamaModel(data.ollamaModel);
        }
        break;
      }

      case 'openrouter_limit_exceeded': {
        setSttStatus('idle');
        setLlmStatus('idle');
        stopPlayback();
        setIsQuotaModalOpen(true);
        break;
      }

      case 'llm_provider_updated': {
        if (data.provider) setLlmProvider(data.provider);
        break;
      }

      case 'openrouter_key_saved': {
        if (data.provider) setLlmProvider(data.provider);
        break;
      }

      case 'mode_updated': {
        if (data.mode) setMode(data.mode);
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
        setIsCallActive(false);
        isCallActiveRef.current = false;
        setErrorBanner(data.message || 'No speech detected.');
        setTimeout(() => setErrorBanner(null), 3000);
        break;
      }

      case 'llm_start': {
        setLlmStatus('streaming');
        setStreamingText('');
        pendingResponseRef.current = null;
        llmDoneRef.current = false;
        break;
      }

      case 'llm_chunk': {
        // Stream tokens to UI immediately — no waiting for audio
        if (data.token) {
          setStreamingText((prev) => prev + data.token);
        }
        break;
      }

      case 'audio_chunk': {
        if (data.audio) {
          enqueueAudio(data.audio, {
            sentenceText: data.sentenceText,
            sentenceIndex: data.sentenceIndex
          });
        }
        break;
      }

      case 'llm_done': {
        setLlmStatus('idle');
        llmDoneRef.current = true;
        // Store the completed response; message is committed to history after playback finishes
        pendingResponseRef.current = { fullText: data.fullText, spokenText: data.spokenText };
        break;
      }

      case 'interrupted': {
        setLlmStatus('idle');
        setStreamingText('');
        pendingResponseRef.current = null;
        stopPlayback();
        break;
      }

      case 'history_cleared': {
        setMessages([]);
        setStreamingText('');
        pendingResponseRef.current = null;
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
  }, [enqueueAudio, stopPlayback, startRecording, isPlaying, handlePlaybackEnded]);

  const { status: wsStatus, error: wsError, sendMessage } = useWebSocket({
    onMessage: handleWsMessage
  });

  useEffect(() => {
    wsStatusRef.current = wsStatus;
    sendMessageRef.current = sendMessage;
  }, [wsStatus, sendMessage]);

  useEffect(() => {
    if (wsStatus === 'connected') {
      setErrorBanner(null);
      const storedKey = localStorage.getItem('openrouter_api_key');
      const storedProvider = localStorage.getItem('llm_provider');
      if (storedKey || storedProvider) {
        sendMessage({
          type: 'set_llm_provider',
          provider: storedProvider || (storedKey ? 'openrouter' : 'local'),
          apiKey: storedKey || undefined
        });
      }
    } else if (wsError) {
      console.log(wsError);
    }
  }, [wsStatus, wsError, sendMessage]);

  const handleCustomApiKey = (key) => {
    setOpenrouterKey(key);
    setLlmProvider('openrouter');
    localStorage.setItem('openrouter_api_key', key);
    localStorage.setItem('llm_provider', 'openrouter');
    setIsQuotaModalOpen(false);
    sendMessage({
      type: 'set_openrouter_key',
      apiKey: key,
      retryLast: true
    });
  };

  const handleSwitchToLocal = () => {
    setLlmProvider('local');
    localStorage.setItem('llm_provider', 'local');
    setIsQuotaModalOpen(false);
    sendMessage({
      type: 'set_llm_provider',
      provider: 'local',
      retryLast: true
    });
  };

  const handleChangeLlmProvider = (prov) => {
    setLlmProvider(prov);
    localStorage.setItem('llm_provider', prov);
    sendMessage({
      type: 'set_llm_provider',
      provider: prov,
      apiKey: openrouterKey || undefined
    });
  };

  const handleSaveOpenrouterKey = (key) => {
    setOpenrouterKey(key);
    localStorage.setItem('openrouter_api_key', key);
    sendMessage({
      type: 'set_openrouter_key',
      apiKey: key
    });
  };

  useEffect(() => {
    if (micError) {
      setErrorBanner(micError);
    }
  }, [micError]);

  const handleSelectMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setMessages([]);
    setStreamingText('');
    stopPlayback();

    const scenario = modeScenarios[newMode] || '';
    sendMessage({
      type: 'set_mode',
      mode: newMode,
      role: newMode === 'interview' ? scenario : modeScenarios.interview,
      scenario: scenario,
      resetHistory: true
    });
  };

  const handleSelectScenarioOption = (val) => {
    setModeScenarios((prev) => ({
      ...prev,
      [mode]: val
    }));
    setMessages([]);
    setStreamingText('');
    stopPlayback();

    sendMessage({
      type: 'set_mode',
      mode: mode,
      role: mode === 'interview' ? val : modeScenarios.interview,
      scenario: val,
      resetHistory: true
    });
  };

  const handleToggleCall = () => {
    if (isRecording || isCallActive) {
      isCallActiveRef.current = false;
      setIsCallActive(false);
      stopRecording();
      stopPlayback();
    } else {
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
    setLlmStatus('idle');
    setStreamingText('');
    if (wsStatus === 'connected') {
      sendMessage({ type: 'interrupt' });
    }
  };

  const handleClearHistory = () => {
    isCallActiveRef.current = false;
    setIsCallActive(false);
    stopPlayback();
    stopRecording();
    setMessages([]);
    setStreamingText('');
    if (wsStatus === 'connected') {
      sendMessage({ type: 'clear_history' });
    }
  };

  const handleSendText = (text) => {
    if (!text.trim()) return;
    llmDoneRef.current = false;
    if (wsStatus === 'connected') {
      sendMessage({
        type: 'text_message',
        text: text.trim(),
        mode,
        role: modeScenarios.interview,
        scenario: modeScenarios[mode] || '',
        voice: selectedVoice,
        speed: speed
      });
    } else {
      handleServerlessTurn(text.trim());
    }
  };

  const handleReplayMessage = (text) => {
    if (!text) return;
    handleSendText(`Please repeat: ${text}`);
  };

  const currentVoiceObj = availableVoices.find(v => v.id === selectedVoice);
  const voiceName = currentVoiceObj ? currentVoiceObj.name : 'Heart';

  return (
    <div className="app-container">
      <Header
        wsStatus={wsStatus}
        mode={mode}
        onSelectMode={handleSelectMode}
        activeLabel={currentActiveScenario}
        onOpenModeModal={() => setIsModeModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenScenarioInfo={() => setIsInfoModalOpen(true)}
        voiceName={voiceName}
      />

      {errorBanner && (
        <div style={{
          background: 'var(--accent-rose-subtle)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: 'var(--accent-rose)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8
        }}>
          <span>{errorBanner}</span>
          <button 
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss error"
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
            mode={mode}
            activeScenario={currentActiveScenario}
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
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        voices={availableVoices}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          localStorage.setItem('selected_voice', v);
          if (sendMessageRef.current) {
            sendMessageRef.current({ type: 'set_settings', voice: v });
          }
        }}
        speed={speed}
        onChangeSpeed={(s) => {
          setSpeed(s);
          sendMessage({ type: 'set_settings', speed: s });
        }}
        silenceTimeout={silenceTimeout}
        onChangeSilenceTimeout={(to) => {
          setSilenceTimeout(to);
          localStorage.setItem('silence_timeout', to);
        }}
        llmProvider={llmProvider}
        onChangeLlmProvider={handleChangeLlmProvider}
        openrouterKey={openrouterKey}
        onSaveOpenrouterKey={handleSaveOpenrouterKey}
        ollamaModel={ollamaModel}
      />

      <QuotaLimitModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        onSubmitApiKey={handleCustomApiKey}
        onSwitchToLocal={handleSwitchToLocal}
        defaultOllamaModel={ollamaModel}
      />

      <ModeModal
        isOpen={isModeModalOpen}
        onClose={() => setIsModeModalOpen(false)}
        activeMode={mode}
        currentValue={currentActiveScenario}
        onSelectOption={handleSelectScenarioOption}
      />

      {isInfoModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">Session Guide & Stats</div>
              <button 
                className="icon-btn" 
                onClick={() => setIsInfoModalOpen(false)} 
                title="Close" 
                type="button" 
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <PracticeCard
              mode={mode}
              activeScenario={currentActiveScenario}
              onOpenModeModal={() => {
                setIsInfoModalOpen(false);
                setIsModeModalOpen(true);
              }}
              messageCount={messages.filter(m => m.role === 'user').length}
              selectedVoiceName={voiceName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
