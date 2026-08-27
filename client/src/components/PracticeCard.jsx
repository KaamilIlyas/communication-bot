import React from 'react';
import { BookOpen, Zap, Award } from 'lucide-react';

export function PracticeCard({ 
  corrections, 
  messageCount, 
  practiceMode,
  selectedVoiceName 
}) {
  return (
    <aside className="side-panel">
      {/* English Practice Panel */}
      <div className="side-card">
        <div className="side-card-title">
          <BookOpen size={18} color="var(--accent-emerald)" />
          <span>English Coaching</span>
        </div>

        {practiceMode ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Practice mode is <strong>active</strong>. The AI will converse naturally and gently point out grammar, tense, or vocabulary improvements.
          </p>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Practice mode is <strong>disabled</strong>. Conversation flows without grammar feedback.
          </p>
        )}

        <div className="side-card-title" style={{ fontSize: '0.85rem', marginTop: 8 }}>
          <Award size={15} color="var(--accent-amber)" />
          <span>Session Corrections ({corrections.length})</span>
        </div>

        <div className="corrections-history-list">
          {corrections.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
              No grammar issues detected yet. Keep speaking naturally!
            </div>
          ) : (
            corrections.map((corr, idx) => (
              <div key={idx} className="correction-banner" style={{ margin: 0 }}>
                <div className="correction-comparison">
                  <span className="bad-text">{corr.original}</span>
                  <span>→</span>
                  <span className="good-text">{corr.corrected}</span>
                </div>
                {corr.explanation && (
                  <div className="correction-explanation">{corr.explanation}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Session & Pipeline Stats */}
      <div className="side-card">
        <div className="side-card-title">
          <Zap size={18} color="var(--accent-primary)" />
          <span>System Pipeline</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">LLM Engine</span>
          <span className="stat-val">Ollama / gemma3:4b</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Speech-to-Text</span>
          <span className="stat-val">Whisper base.en</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Voice (TTS)</span>
          <span className="stat-val" style={{ color: 'var(--accent-cyan)' }}>
            {selectedVoiceName || 'Heart'}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Turns Spoken</span>
          <span className="stat-val">{messageCount}</span>
        </div>
      </div>
    </aside>
  );
}
