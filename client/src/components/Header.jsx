import React from 'react';
import { Mic, Bot, Settings, BookOpen } from 'lucide-react';

export function Header({ 
  wsStatus, 
  practiceMode, 
  onTogglePracticeMode, 
  onOpenSettings,
  voiceName
}) {
  return (
    <header className="header">
      <div className="brand-section">
        <div className="logo-badge">
          <Mic size={22} />
        </div>
        <div>
          <h1 className="brand-title">English Voice AI</h1>
          <div className="brand-subtitle">
            <span>Real-Time Conversational Partner</span>
            <span>•</span>
            <span style={{ color: 'var(--accent-cyan)' }}>{voiceName || 'Piper TTS'}</span>
          </div>
        </div>
      </div>

      <div className="engine-tags">
        <div className="engine-pill" title="Local Whisper STT Model">
          <span className={`status-dot ${wsStatus === 'connected' ? 'online' : 'error'}`} />
          <span>Whisper (base.en)</span>
        </div>
        <div className="engine-pill" title="Local Gemma 3 4B via Ollama">
          <Bot size={13} style={{ color: 'var(--accent-primary)' }} />
          <span>gemma3:4b</span>
        </div>
      </div>

      <div className="header-actions">
        <button 
          id="practice-mode-toggle-btn"
          className={`practice-mode-toggle ${practiceMode ? 'active' : ''}`}
          onClick={onTogglePracticeMode}
          title="Toggle English Practice Mode to get gentle grammar & vocabulary coaching"
        >
          <BookOpen size={16} color="var(--accent-emerald)" />
          <span className="practice-toggle-text">
            {practiceMode ? 'Practice Mode: ON' : 'Practice Mode: OFF'}
          </span>
        </button>

        <button 
          id="settings-modal-btn"
          className="icon-btn" 
          onClick={onOpenSettings}
          title="Audio & AI Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
