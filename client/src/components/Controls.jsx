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
    <div className="controls-bar">
      {/* Left: Clear / Reset */}
      <div>
        <button 
          id="clear-history-btn"
          className="icon-btn" 
          onClick={onClearHistory}
          title="Clear Conversation History"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Center: Main Push-to-Talk & Interrupt Action */}
      <div className="mic-action-group">
        {isPlaying && (
          <button 
            id="interrupt-ai-btn"
            className="interrupt-btn" 
            onClick={onInterrupt}
            title="Interrupt and stop AI speaking"
          >
            <Square size={14} fill="currentColor" />
            <span>Interrupt</span>
          </button>
        )}

        <button
          id="main-mic-btn"
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={handleToggle}
          type="button"
          title={isRecording ? 'Click to pause/stop voice call' : 'Click once to start real-time English conversation'}
        >
          {isRecording ? <Mic size={30} /> : <Mic size={28} />}
        </button>

        <button 
          id="auto-send-toggle-btn"
          className={`icon-btn ${autoSend ? 'active' : ''}`}
          onClick={onToggleAutoSend}
          type="button"
          style={{ 
            color: autoSend ? 'var(--accent-cyan)' : 'var(--text-dim)',
            borderColor: autoSend ? 'var(--accent-cyan)' : 'var(--border-glass)'
          }}
          title={autoSend ? 'Hands-Free VAD Mode: ON' : 'Hands-Free VAD Mode: OFF (Push-to-Talk)'}
        >
          <Radio size={18} />
        </button>
      </div>

      {/* Right: Quick text input fallback */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, width: '280px' }}>
        <input
          id="text-chat-input"
          type="text"
          className="form-input"
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
          placeholder="Type English message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button 
          id="send-text-btn"
          type="submit" 
          className="icon-btn" 
          disabled={!inputText.trim()}
          title="Send typed message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
