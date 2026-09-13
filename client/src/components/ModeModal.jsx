import React, { useState, useEffect } from 'react';
import { X, Briefcase, GraduationCap, Building2, Swords, Check, ArrowRight } from 'lucide-react';

const MODE_CONFIGS = {
  interview: {
    title: 'Select Interview Target',
    icon: <Briefcase size={20} color="var(--primary)" />,
    description: 'Customize the role and focus areas your interviewer will evaluate during this session.',
    presets: [
      { id: 'mern', name: 'Full-Stack Developer', icon: '🚀', desc: 'React, Node.js, REST APIs, state architecture & system design' },
      { id: 'fyp', name: 'Project & Portfolio Defense', icon: '🎓', desc: 'Deep dive into your project architecture, database design & tradeoffs' },
      { id: 'frontend', name: 'Frontend React Engineer', icon: '⚛️', desc: 'Hooks, component rendering performance, state management & UI engineering' },
      { id: 'backend', name: 'Backend & Systems Engineer', icon: '🛠️', desc: 'Event loop, middleware, database query optimization & auth flows' },
      { id: 'custom', name: 'Custom Job Role', icon: '✏️', desc: 'Specify any target job title or specialized engineering focus' }
    ]
  },
  ielts: {
    title: 'IELTS Speaking Exam Setup',
    icon: <GraduationCap size={20} color="var(--accent-amber)" />,
    description: 'Select the stage or full test simulation to practice with your certified examiner.',
    presets: [
      { id: 'full', name: 'Full Speaking Test (Parts 1-3)', icon: '📋', desc: 'Complete 3-part exam simulation with detailed rubric feedback' },
      { id: 'part1', name: 'Part 1: Everyday Questions', icon: '🗣️', desc: 'Short warm-up questions on hometown, work, hobbies & daily routines' },
      { id: 'part2', name: 'Part 2: Cue Card Long Turn', icon: '⏱️', desc: '2-minute uninterrupted speech on a prompted topic card' },
      { id: 'part3', name: 'Part 3: Abstract Discussion', icon: '💡', desc: 'Two-way analytical exploration of social, cultural & tech issues' }
    ]
  },
  workplace: {
    title: 'Workplace Scenario',
    icon: <Building2 size={20} color="var(--accent-sky)" />,
    description: 'Choose a corporate communication context to practice persuasion, structure, and professional clarity.',
    presets: [
      { id: 'salary', name: 'Salary & Promotion Review', icon: '💼', desc: 'Present quantifiable wins, negotiate compensation, and address counter-offers' },
      { id: 'pitch', name: 'Stakeholder & Client Pitch', icon: '📊', desc: 'Pitch a technical solution and navigate demanding stakeholder questions' },
      { id: 'standup', name: 'Agile Sprint Standup', icon: '⏱️', desc: 'Deliver crisp updates, highlight blockers, and outline upcoming milestones' },
      { id: 'conflict', name: 'Timeline & Scope Negotiation', icon: '🤝', desc: 'Politely push back on unrealistic deadlines and negotiate deliverables' }
    ]
  },
  debate: {
    title: 'Debate Motion & Topic',
    icon: <Swords size={20} color="var(--accent-rose)" />,
    description: 'Select a motion. The AI will challenge your arguments to build rapid reasoning and persuasive delivery.',
    presets: [
      { id: 'ai_jobs', name: 'AI & Automation vs Human Jobs', icon: '🤖', desc: 'Will AI displace software developers or amplify human problem solving?' },
      { id: 'remote', name: 'Remote vs In-Office Work', icon: '🏡', desc: 'Productivity, collaboration, culture, and team velocity' },
      { id: 'monolith', name: 'Microservices vs Monoliths', icon: '🏗️', desc: 'Operational simplicity vs scalable team boundaries' },
      { id: 'social', name: 'Social Media & Attention Economy', icon: '📱', desc: 'Knowledge democratization vs attention fragmentation' },
      { id: 'custom_debate', name: 'Custom Debate Motion', icon: '✏️', desc: 'Enter any debate statement or controversial topic' }
    ]
  }
};

export function ModeModal({
  isOpen,
  onClose,
  activeMode,
  currentValue,
  onSelectOption
}) {
  const config = MODE_CONFIGS[activeMode] || MODE_CONFIGS.interview;
  
  const [selectedId, setSelectedId] = useState('mern');
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const presets = config.presets;
    const match = presets.find(p => p.name === currentValue);
    if (match) {
      setSelectedId(match.id);
      setCustomInput('');
    } else {
      const isCustom = activeMode === 'debate' ? 'custom_debate' : 'custom';
      setSelectedId(isCustom);
      setCustomInput(currentValue || '');
    }
  }, [isOpen, activeMode, currentValue, config]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedId === 'custom' || selectedId === 'custom_debate') {
      const finalVal = customInput.trim() || (activeMode === 'debate' ? 'Technology Ethics' : 'Software Engineer');
      onSelectOption(finalVal);
    } else {
      const preset = config.presets.find(p => p.id === selectedId);
      if (preset) {
        onSelectOption(preset.name);
      }
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {config.icon}
            <span>{config.title}</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close Modal" type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {config.description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {config.presets.map((preset) => {
            const isSelected = selectedId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => setSelectedId(preset.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-subtle)',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  minWidth: 0
                }}
              >
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{preset.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.86rem', 
                    fontWeight: 600, 
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {preset.name}
                  </div>
                  <div style={{ 
                    fontSize: '0.72rem', 
                    color: 'var(--text-muted)', 
                    marginTop: 2,
                    lineHeight: 1.35
                  }}>
                    {preset.desc}
                  </div>
                </div>
                {isSelected && <Check size={16} color="var(--primary)" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {(selectedId === 'custom' || selectedId === 'custom_debate') && (
          <div className="form-group" style={{ marginTop: 4 }}>
            <label className="form-label">
              {activeMode === 'debate' ? 'Custom Debate Motion' : 'Custom Target Role'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={activeMode === 'debate' ? 'e.g. AI copyright policies...' : 'e.g. Senior Machine Learning Engineer...'}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }} type="button">
            Cancel
          </button>
          <button className="btn-primary" onClick={handleApply} style={{ flex: 1 }} type="button">
            <span>Apply Scenario</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
