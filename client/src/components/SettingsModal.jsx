import React from 'react';
import { X, Sliders, Volume2 } from 'lucide-react';

export function SettingsModal({
  isOpen,
  onClose,
  voices = [],
  selectedVoice,
  onSelectVoice,
  speed,
  onChangeSpeed,
  silenceTimeout,
  onChangeSilenceTimeout,
  llmProvider = 'openrouter',
  onChangeLlmProvider = () => {},
  openrouterKey = '',
  onSaveOpenrouterKey = () => {},
  ollamaModel = 'gemma3:4b'
}) {
  const [inputKey, setInputKey] = React.useState(openrouterKey);
  const [showKey, setShowKey] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    setInputKey(openrouterKey);
  }, [openrouterKey]);
  if (!isOpen) return null;

  const formatVoiceName = (name, gender) => {
    const clean = name
      .replace(/[💖✨🤖]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    const genderLabel = gender ? ` (${gender})` : '';
    return `${clean}${genderLabel}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} color="var(--primary)" />
            <span>Voice & Audio Settings</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close Settings" type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Speaker Voice</label>
          <select 
            id="voice-select-dropdown"
            className="form-select"
            value={selectedVoice}
            onChange={(e) => onSelectVoice(e.target.value)}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {formatVoiceName(v.name, v.gender)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Speech Speed Rate</label>
            <span style={{ 
              fontSize: '0.78rem', 
              color: 'var(--primary)', 
              fontFamily: 'var(--font-mono)',
              background: 'var(--primary-subtle)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)'
            }}>
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
            aria-label="Speech speed"
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Hands-Free Silence Detection</label>
            <span style={{ 
              fontSize: '0.78rem', 
              color: 'var(--accent-emerald)', 
              fontFamily: 'var(--font-mono)',
              background: 'var(--accent-emerald-subtle)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)'
            }}>
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
            aria-label="Silence detection timeout"
          />
        </div>

        <div className="form-group" style={{ marginTop: 2 }}>
          <label className="form-label">AI Intelligence Provider</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onChangeLlmProvider('openrouter')}
              style={{
                padding: '8px 10px',
                fontSize: '0.8rem',
                border: llmProvider === 'openrouter' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                background: llmProvider === 'openrouter' ? 'var(--primary-subtle)' : 'var(--bg-surface-elevated)',
                color: llmProvider === 'openrouter' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: llmProvider === 'openrouter' ? 600 : 400
              }}
            >
              Cloud (OpenRouter)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onChangeLlmProvider('local')}
              style={{
                padding: '8px 10px',
                fontSize: '0.8rem',
                border: llmProvider === 'local' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                background: llmProvider === 'local' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-elevated)',
                color: llmProvider === 'local' ? '#10b981' : 'var(--text-secondary)',
                fontWeight: llmProvider === 'local' ? 600 : 400
              }}
            >
              Local (Ollama Mac)
            </button>
          </div>

          {llmProvider === 'openrouter' && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="Custom OpenRouter Key (sk-or-v1-...)"
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(e.target.value);
                    setSavedSuccess(false);
                  }}
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', flex: 1 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onSaveOpenrouterKey(inputKey);
                    setSavedSuccess(true);
                    setTimeout(() => setSavedSuccess(false), 2500);
                  }}
                  style={{ fontSize: '0.78rem', padding: '0 12px', whiteSpace: 'nowrap' }}
                >
                  {savedSuccess ? 'Saved!' : 'Save Key'}
                </button>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Leave blank for default free tier, or paste your personal key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>openrouter.ai</a>.
              </span>
            </div>
          )}

          {llmProvider === 'local' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Running offline on Mac with local Ollama (<code style={{ color: '#10b981' }}>{ollamaModel || 'gemma3:4b'}</code>). Unlimited & private.
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: 2 }}>
          <label className="form-label">Speech & Audio Engine</label>
          <div style={{ 
            background: 'var(--bg-surface-elevated)', 
            border: '1px solid var(--border-subtle)',
            padding: '10px 12px', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}>
            <div>• <strong>Speech-to-Text:</strong> Local Whisper (Real-Time INT8)</div>
            <div>• <strong>Language Model:</strong> {llmProvider === 'openrouter' ? 'OpenRouter Free / Custom Cloud' : `Local Ollama (${ollamaModel})`}</div>
            <div>• <strong>Speech Synthesis:</strong> Kokoro Neural TTS (High Quality)</div>
          </div>
        </div>

        <button 
          id="close-settings-btn"
          className="btn-primary" 
          onClick={onClose}
          style={{ width: '100%', marginTop: 6 }}
          type="button"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
