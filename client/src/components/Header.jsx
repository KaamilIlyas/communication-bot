import React, { useState } from 'react';
import { 
  Mic, 
  Settings, 
  MessageSquare, 
  Briefcase, 
  GraduationCap, 
  Building2, 
  Swords, 
  ChevronDown,
  Info,
  X,
  Check,
  SlidersHorizontal
} from 'lucide-react';

const MODES = [
  { id: 'casual', label: 'Casual', title: 'Casual Conversation', icon: MessageSquare, desc: 'Relaxed everyday English practice' },
  { id: 'interview', label: 'Interview', title: 'Job Mock Interview', icon: Briefcase, desc: 'Technical questions, system design & STAR method' },
  { id: 'ielts', label: 'IELTS', title: 'IELTS Speaking Exam', icon: GraduationCap, desc: 'Official 3-part test simulation with scoring rubric' },
  { id: 'workplace', label: 'Workplace', title: 'Workplace & Pitch', icon: Building2, desc: 'Salary reviews, sprint updates & executive pitches' },
  { id: 'debate', label: 'Debate', title: 'Debate & Rhetoric', icon: Swords, desc: 'Adversarial counter-arguments & critical thinking' }
];

export function Header({ 
  mode = 'casual',
  onSelectMode,
  activeLabel,
  onOpenModeModal,
  onOpenSettings,
  onOpenScenarioInfo,
  voiceName
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const currentModeObj = MODES.find(m => m.id === mode) || MODES[0];
  const CurrentIcon = currentModeObj.icon;

  // Clean voice name of any emojis/symbols
  const cleanVoiceName = (voiceName || 'Heart')
    .replace(/[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[💖🎙️✨🎩🌸🌿🚀🤖💡]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // Shorten active label gracefully for small screens with ellipsis
  const formatRoleLabel = (label) => {
    if (!label) return '';
    if (label.length > 22) {
      return label.slice(0, 20) + '..';
    }
    return label;
  };

  const handleSelectFromDrawer = (newMode) => {
    onSelectMode(newMode);
    setIsDrawerOpen(false);
  };

  return (
    <header className="header">
      <div className="header-brand-row">
        <div className="brand-section">
          <div className="logo-badge" title="FluentAI Voice Assistant">
            <Mic size={18} />
          </div>
          <div className="brand-text-container">
            <h1 className="brand-title">FluentAI</h1>
            <div className="brand-subtitle">
              <span>{currentModeObj.title}</span>
              <span>•</span>
              <span className="voice-badge-pill" title={`Voice: ${cleanVoiceName}`}>
                {cleanVoiceName}
              </span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {onOpenScenarioInfo && (
            <button
              id="header-info-btn"
              className="icon-btn"
              onClick={onOpenScenarioInfo}
              title="View Guide & Session Stats"
              type="button"
              aria-label="View Guide & Session Stats"
            >
              <Info size={17} />
            </button>
          )}

          <button 
            id="settings-modal-btn"
            className="icon-btn" 
            onClick={onOpenSettings}
            title="Audio & Voice Settings"
            type="button"
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Desktop Mode Tabs (>= 769px) */}
      <nav className="mode-switcher-desktop" aria-label="Conversation Modes">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              id={`mode-${m.id}-btn`}
              className={`mode-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectMode(m.id)}
              title={m.desc}
              type="button"
            >
              <Icon size={13} />
              <span>{m.label}</span>
            </button>
          );
        })}

        {mode !== 'casual' && activeLabel && (
          <button
            id="open-mode-modal-btn"
            className="role-chip-btn"
            onClick={onOpenModeModal}
            title={`Active: ${activeLabel}. Click to customize.`}
            type="button"
          >
            <span className="role-chip-text">{formatRoleLabel(activeLabel)}</span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>
        )}
      </nav>

      {/* Mobile Drawer Trigger Bar (< 769px) */}
      <div className="mode-switcher-mobile">
        <button
          id="mobile-mode-drawer-btn"
          className="mobile-mode-trigger-btn"
          onClick={() => setIsDrawerOpen(true)}
          type="button"
          aria-label="Change conversation mode"
        >
          <div className="mobile-mode-info">
            <CurrentIcon size={15} color="var(--primary)" />
            <span className="mobile-mode-badge">{currentModeObj.label}</span>
            {mode !== 'casual' && activeLabel && (
              <span className="mobile-preset-badge">
                {formatRoleLabel(activeLabel)}
              </span>
            )}
          </div>
          <div className="mobile-mode-action">
            <span>Change Mode</span>
            <ChevronDown size={13} />
          </div>
        </button>

        {mode !== 'casual' && activeLabel && (
          <button
            id="mobile-customize-preset-btn"
            className="icon-btn"
            style={{ width: 34, height: 34 }}
            onClick={onOpenModeModal}
            title="Customize Scenario / Role"
            type="button"
            aria-label="Customize Scenario"
          >
            <SlidersHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Mobile Mode Drawer Sheet */}
      {isDrawerOpen && (
        <div className="modal-overlay" onClick={() => setIsDrawerOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-card drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="var(--primary)" />
                <span>Choose Practice Mode</span>
              </div>
              <button 
                className="icon-btn" 
                onClick={() => setIsDrawerOpen(false)} 
                title="Close" 
                type="button" 
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Select a conversation scenario to customize your English practice:
            </p>

            <div className="drawer-mode-list">
              {MODES.map((m) => {
                const Icon = m.icon;
                const isSelected = mode === m.id;
                return (
                  <div
                    key={m.id}
                    className={`drawer-mode-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectFromDrawer(m.id)}
                  >
                    <div className="drawer-mode-icon-box">
                      <Icon size={18} color={isSelected ? '#ffffff' : 'var(--text-secondary)'} />
                    </div>
                    <div className="drawer-mode-content">
                      <div className="drawer-mode-name">{m.title}</div>
                      <div className="drawer-mode-desc">{m.desc}</div>
                    </div>
                    {isSelected && <Check size={17} color="var(--primary)" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
