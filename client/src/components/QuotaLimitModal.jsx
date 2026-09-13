import React, { useState } from 'react';
import { AlertTriangle, Key, Cpu, ExternalLink, Eye, EyeOff, X } from 'lucide-react';

export function QuotaLimitModal({
  isOpen,
  onClose,
  onSubmitApiKey,
  onSwitchToLocal,
  defaultOllamaModel = 'gemma3:4b'
}) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmitKey = (e) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a valid OpenRouter API key');
      return;
    }
    setErrorMsg('');
    onSubmitApiKey(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: 480, gap: 18 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span>OpenRouter Limit Reached</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close" type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          The daily free usage quota or rate limit for OpenRouter has been reached. Choose how you would like to proceed:
        </p>

        {/* Option 1: Enter Custom OpenRouter Key */}
        <div style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Key size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Option 1: Use Your Own OpenRouter Key
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Connect your account for personal limits and access
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmitKey} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="openrouter-user-api-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="form-input"
                style={{ paddingRight: 40, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errorMsg && (
              <span style={{ fontSize: '0.74rem', color: '#ef4444' }}>{errorMsg}</span>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none'
                }}
              >
                <span>Get an API Key</span>
                <ExternalLink size={12} />
              </a>

              <button
                type="submit"
                id="submit-custom-key-btn"
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem' }}
              >
                Use My Key & Retry
              </button>
            </div>
          </form>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: 'var(--text-muted)',
          fontSize: '0.74rem',
          fontWeight: 600,
          textTransform: 'uppercase'
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span>Or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Option 2: Run Locally via Ollama */}
        <div style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <Cpu size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Option 2: Run Locally with Ollama
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                100% free, private & runs on your Mac ({defaultOllamaModel})
              </div>
            </div>
          </div>

          <button
            type="button"
            id="switch-to-local-btn"
            onClick={onSwitchToLocal}
            className="btn-secondary"
            style={{
              width: '100%',
              padding: '9px 14px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: 'var(--text-primary)'
            }}
          >
            <Cpu size={16} color="#10b981" />
            <span>Switch to Local Ollama & Retry</span>
          </button>
        </div>
      </div>
    </div>
  );
}
