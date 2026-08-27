import React from 'react';
import { X, Sliders } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  voices = [],
  selectedVoice,
  onSelectVoice,
  speed,
  onChangeSpeed,
  silenceTimeout,
  onChangeSilenceTimeout
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={20} color="var(--accent-primary)" />
            <span>Voice & Audio Settings</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close Settings">
            <X size={18} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Neural Voice Model</label>
          <select 
            id="voice-select-dropdown"
            className="form-select"
            value={selectedVoice}
            onChange={(e) => onSelectVoice(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.gender})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="form-label">Speech Rate / Speed</label>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {speed}x
            </span>
          </div>
          <input
            id="speed-slider-input"
            type="range"
            min="0.75"
            max="1.5"
            step="0.05"
            value={speed}
            onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
            style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="form-label">Hands-Free Silence Detection Timeout</label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {silenceTimeout} ms
            </span>
          </div>
          <input
            id="silence-timeout-input"
            type="range"
            min="800"
            max="3000"
            step="200"
            value={silenceTimeout}
            onChange={(e) => onChangeSilenceTimeout(parseInt(e.target.value, 10))}
            style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
          />
        </div>

        <div className="form-group" style={{ marginTop: 6 }}>
          <label className="form-label">Local Pipeline Summary</label>
          <div style={{ 
            background: 'rgba(0,0,0,0.25)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-sm)', 
            fontSize: '0.78rem',
            color: 'var(--text-dim)',
            lineHeight: 1.6
          }}>
            <div>• <strong>LLM:</strong> Ollama / gemma3:4b (Local Streaming)</div>
            <div>• <strong>STT:</strong> Faster-Whisper base.en (CPU INT8)</div>
            <div>• <strong>TTS:</strong> Kokoro Neural Voices & Piper ONNX</div>
          </div>
        </div>

        <button 
          id="close-settings-btn"
          className="btn-primary" 
          onClick={onClose}
          style={{ width: '100%', marginTop: 8 }}
        >
          Save & Apply
        </button>
      </div>
    </div>
  );
}
