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
  const [silenceTimeout, setSilenceTimeout] = useState(3000);
  const [isCallActive, setIsCallActive] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [availableVoices, setAvailableVoices] = useState([]);
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

  // Serverless HTTP turn (used when deployed on Vercel or disconnected from local WS)
  const handleServerlessTurn = useCallback(async (userText) => {
    if (!userText || !userText.trim()) return;

    const userMsg = {
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, userMsg]);
    setLlmStatus('streaming');
    setStreamingText('');

    const conversationHistory = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    })).slice(-12);

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

      const assistantMsg = {
        role: 'assistant',
        content: fullAssistantText,
        spokenText: fullAssistantText,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Speak text using browser native speech synthesis
      speakText(fullAssistantText, {
        speed,
        onEnd: () => {
          if (isCallActiveRef.current) {
            setTimeout(() => {
              if (isCallActiveRef.current) startRecording();
            }, 600);
          }
        }
      });
    } catch (err) {
      console.error('[Serverless Turn] error:', err);
      setLlmStatus('idle');
      setErrorBanner(err.message);
      setTimeout(() => setErrorBanner(null), 6000);
    }
  }, [messages, mode, modeScenarios, openrouterKey, speakText, speed, startRecording]);

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
            else setErrorBanner('No speech detected. Please speak into your microphone.');
            setTimeout(() => setErrorBanner(null), 4000);
            if (isCallActiveRef.current) {
              setTimeout(() => { if (isCallActiveRef.current) startRecording(); }, 800);
            }
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
  }, [mode, modeScenarios, selectedVoice, speed, handleServerlessTurn, startRecording]);

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

  // Called when each audio chunk starts playing — no longer needs to update streaming text
  // because llm_chunk now streams text directly to the UI in real-time
  const handleChunkStarted = useCallback((_meta) => {
    // intentionally left empty; streaming text is updated via llm_chunk
  }, []);

  // Called when all queued audio chunks have completely finished playing
  const handlePlaybackEnded = useCallback(() => {
    // If we have a pending LLM response, finalize it into message history
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
        if (isCallActiveRef.current) {
          startRecording();
        }
      }, 600);
    }
  }, [startRecording]);

  const { isPlaying, enqueueAudio, speakText, stopPlayback, analyserNode: playerAnalyser } = useAudioPlayer({
    onPlaybackEnded: handlePlaybackEnded,
    onChunkStarted: handleChunkStarted
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
        setErrorBanner(data.message || 'No speech detected.');
        setTimeout(() => setErrorBanner(null), 4000);
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
          sendMessage({ type: 'set_settings', voice: v });
        }}
        speed={speed}
        onChangeSpeed={(s) => {
          setSpeed(s);
          sendMessage({ type: 'set_settings', speed: s });
        }}
        silenceTimeout={silenceTimeout}
        onChangeSilenceTimeout={setSilenceTimeout}
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
