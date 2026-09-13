import React, { useState } from 'react';
import { Mic, Square, Send, RotateCcw, Radio } from 'lucide-react';

export function Controls({
  isRecording,
  isPlaying,
  autoSend,
  onToggleAutoSend,
  onToggleRecord,
  onInterrupt,
  onSendText,
  onClearHistory
}) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  const handleToggle = (e) => {
    e.preventDefault();
    onToggleRecord();
  };

  return (
    <footer className="controls-bar" aria-label="Conversation controls">
      {/* Voice actions container */}
      <div className="controls-voice-group">
        <div className="controls-left">
          <button 
            id="clear-history-btn"
            className="icon-btn" 
            onClick={onClearHistory}
            title="Reset conversation history"
            type="button"
            aria-label="Reset conversation"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="controls-center">
          {isPlaying && (
            <button 
              id="interrupt-ai-btn"
              className="interrupt-btn" 
              onClick={onInterrupt}
              title="Stop AI speech"
              type="button"
            >
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          )}

          <button
            id="main-mic-btn"
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={handleToggle}
            type="button"
            title={isRecording ? 'Click to stop speaking' : 'Click to start speaking'}
            aria-label={isRecording ? 'Stop microphone' : 'Start microphone'}
          >
            <Mic size={22} />
          </button>

          <button 
            id="auto-send-toggle-btn"
            className={`icon-btn ${autoSend ? 'active' : ''}`}
            onClick={onToggleAutoSend}
            type="button"
            style={{ 
              color: autoSend ? 'var(--accent-emerald)' : 'var(--text-muted)',
              borderColor: autoSend ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
              background: autoSend ? 'var(--accent-emerald-subtle)' : 'var(--bg-surface-subtle)'
            }}
            title={autoSend ? 'Hands-Free VAD: ON' : 'Hands-Free VAD: OFF'}
            aria-label="Toggle hands-free mode"
          >
            <Radio size={16} />
          </button>
        </div>
      </div>

      {/* Text message fallback input */}
      <div className="controls-right">
        <form onSubmit={handleSubmit} className="text-input-form">
          <input
            id="text-chat-input"
            type="text"
            className="text-chat-input"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            aria-label="Text message input"
          />
          <button 
            id="send-text-btn"
            type="submit" 
            className="icon-btn send-btn" 
            disabled={!inputText.trim()}
            title="Send message"
            aria-label="Send message"
            style={{
              color: inputText.trim() ? '#ffffff' : 'var(--text-disabled)',
              background: inputText.trim() ? 'var(--primary)' : 'var(--bg-surface-subtle)',
              borderColor: inputText.trim() ? 'var(--primary)' : 'var(--border-subtle)',
              opacity: inputText.trim() ? 1 : 0.5
            }}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </footer>
  );
}
