import React from 'react';
import { 
  BarChart3, 
  MessageSquare,
  Briefcase, 
  GraduationCap, 
  Building2, 
  Swords, 
  SlidersHorizontal 
} from 'lucide-react';

export function PracticeCard({ 
  mode = 'casual',
  activeScenario = '',
  onOpenModeModal,
  messageCount = 0, 
  selectedVoiceName = 'Heart'
}) {
  const cleanVoice = (selectedVoiceName || 'Heart')
    .replace(/[💖✨🤖]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const renderModeSpecificPanel = () => {
    switch (mode) {
      case 'interview':
        return (
          <>
            <div className="side-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={17} color="var(--primary)" />
                <span>Job Interview Guide</span>
              </div>
              <button 
                className="icon-btn" 
                style={{ width: 28, height: 28 }}
                onClick={onOpenModeModal}
                title="Change Target Role"
                type="button"
                aria-label="Change target role"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="scenario-badge-box">
              <span className="scenario-badge-label">Target Role</span>
              <span className="scenario-badge-value">{activeScenario || 'Full-Stack Developer'}</span>
            </div>

            <div className="scenario-tip-text">
              💡 <strong>STAR Method:</strong> Structure your answers with <em>Situation</em>, <em>Task</em>, <em>Action</em>, and measurable <em>Result</em>.
            </div>
          </>
        );

      case 'ielts':
        return (
          <>
            <div className="side-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GraduationCap size={17} color="var(--accent-amber)" />
                <span>IELTS Speaking Criteria</span>
              </div>
              <button 
                className="icon-btn" 
                style={{ width: 28, height: 28 }}
                onClick={onOpenModeModal}
                title="Change Exam Stage"
                type="button"
                aria-label="Change exam stage"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="scenario-badge-box">
              <span className="scenario-badge-label">Current Stage</span>
              <span className="scenario-badge-value">{activeScenario || 'Full Speaking Test'}</span>
            </div>

            <div className="scenario-tip-text">
              📊 <strong>Scoring Focus:</strong> Fluency & Coherence (25%), Lexical Resource (25%), Grammatical Range (25%), Pronunciation (25%).
            </div>
          </>
        );

      case 'workplace':
        return (
          <>
            <div className="side-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={17} color="var(--accent-sky)" />
                <span>Workplace Scenario</span>
              </div>
              <button 
                className="icon-btn" 
                style={{ width: 28, height: 28 }}
                onClick={onOpenModeModal}
                title="Change Workplace Scenario"
                type="button"
                aria-label="Change scenario"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="scenario-badge-box">
              <span className="scenario-badge-label">Active Scenario</span>
              <span className="scenario-badge-value">{activeScenario || 'Salary & Promotion Negotiation'}</span>
            </div>

            <div className="scenario-tip-text">
              💼 <strong>Communication Tip:</strong> Anchor requests with measurable business impact, collaborative tone, and calm confidence.
            </div>
          </>
        );

      case 'debate':
        return (
          <>
            <div className="side-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Swords size={17} color="var(--accent-rose)" />
                <span>Debate Motion</span>
              </div>
              <button 
                className="icon-btn" 
                style={{ width: 28, height: 28 }}
                onClick={onOpenModeModal}
                title="Change Debate Motion"
                type="button"
                aria-label="Change motion"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="scenario-badge-box">
              <span className="scenario-badge-label">Motion</span>
              <span className="scenario-badge-value">{activeScenario || 'AI & Automation vs Human Jobs'}</span>
            </div>

            <div className="scenario-tip-text">
              ⚔️ <strong>Rhetoric Tip:</strong> State your claim upfront, cite concrete evidence, and anticipate counter-arguments directly.
            </div>
          </>
        );

      default:
        return (
          <>
            <div className="side-card-title">
              <MessageSquare size={17} color="var(--primary)" />
              <span>Casual Partner</span>
            </div>

            <p className="scenario-tip-text">
              Converse naturally on any topic. Practice spontaneous answers, everyday idioms, and pronunciation in an encouraging environment.
            </p>
          </>
        );
    }
  };

  return (
    <aside className="side-panel">
      {/* Mode / Scenario Card */}
      <div className="side-card">
        {renderModeSpecificPanel()}
      </div>

      {/* Session & Performance Stats */}
      <div className="side-card">
        <div className="side-card-title">
          <BarChart3 size={17} color="var(--primary)" />
          <span>Session Stats</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Conversation Mode</span>
          <span className="stat-val" style={{ textTransform: 'capitalize' }}>
            {mode}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Turns Spoken</span>
          <span className="stat-val">{messageCount}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Neural Voice</span>
          <span className="stat-val">
            {cleanVoice}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Pipeline</span>
          <span className="stat-val" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Whisper STT • Ollama
          </span>
        </div>
      </div>
    </aside>
  );
}
