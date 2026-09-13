import React, { useRef, useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Briefcase, 
  GraduationCap, 
  Building2, 
  Swords, 
  Volume2, 
  User, 
  Bot,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';

export function ConversationView({ 
  messages, 
  streamingText, 
  mode = 'casual',
  activeScenario = '',
  onSelectStarter,
  onReplayMessage 
}) {
  const scrollRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const getModeDetails = () => {
    switch (mode) {
      case 'interview':
        return {
          icon: <Briefcase size={26} color="var(--primary)" />,
          title: `${activeScenario || 'Full-Stack'} Mock Interview`,
          description: 'Your technical interviewer is ready. Select a starting question or tap the microphone to begin.',
          speakerLabel: 'Interviewer',
          userLabel: 'You',
          starters: [
            `I'm ready. Let's begin the ${activeScenario || 'technical'} interview.`,
            "Ask me to walk through my most challenging project architecture.",
            "Quiz me on React hooks, performance optimization, and state management.",
            "Ask me about backend database indexing and handling concurrency."
          ]
        };

      case 'ielts':
        return {
          icon: <GraduationCap size={26} color="var(--accent-amber)" />,
          title: `IELTS Speaking: ${activeScenario || 'Full Test'}`,
          description: 'Your certified examiner is ready. Choose an exam stage or tap the microphone to start speaking.',
          speakerLabel: 'Examiner',
          userLabel: 'You',
          starters: [
            "Good morning Examiner, I'm ready to begin Part 1.",
            "Give me an IELTS Part 2 Cue Card topic with 1 minute prep time.",
            "Let's move on to Part 3 abstract discussion questions.",
            "Please evaluate my answer and suggest improvements for fluency."
          ]
        };

      case 'workplace':
        return {
          icon: <Building2 size={26} color="var(--accent-sky)" />,
          title: `Workplace: ${activeScenario || 'Negotiation'}`,
          description: 'Practice high-stakes business communication, salary reviews, and client presentations.',
          speakerLabel: 'Manager',
          userLabel: 'You',
          starters: [
            "I'd like to discuss my recent performance achievements and compensation review.",
            "Here is the architecture proposal and roadmap for our next sprint.",
            "Here is my quick standup update on key milestones and current blockers.",
            "I need to discuss scope adjustments and realistic timeline expectations."
          ]
        };

      case 'debate':
        return {
          icon: <Swords size={26} color="var(--accent-rose)" />,
          title: `Debate: ${activeScenario || 'Topic'}`,
          description: 'Train logical reasoning, counter-arguments, and persuasive rhetoric with an opposing debater.',
          speakerLabel: 'Opponent',
          userLabel: 'You',
          starters: [
            "I believe AI will augment rather than replace human software engineers.",
            "Remote work is demonstrably superior to in-office work for developer productivity.",
            "Monolithic architecture is far more practical than microservices for 90% of apps.",
            "Social media algorithms cause more societal harm than educational benefit."
          ]
        };

      default:
        return {
          icon: <MessageSquare size={26} color="var(--primary)" />,
          title: 'English Conversation Practice',
          description: 'Talk naturally about any topic. Practice pronunciation, fluency, and conversational vocabulary.',
          speakerLabel: 'Partner',
          userLabel: 'You',
          starters: [
            "Tell me about an interesting city you'd recommend visiting.",
            "Let's roleplay ordering coffee and breakfast at a bakery.",
            "What habits help someone become a more fluent speaker?",
            "What are some common English idioms and how do I use them?"
          ]
        };
    }
  };

  const currentModeDetails = getModeDetails();

  return (
    <div className="messages-container" ref={scrollRef}>
      {messages.length === 0 && !streamingText ? (
        <div className="empty-chat-state">
          <div className="empty-chat-icon">
            {currentModeDetails.icon}
          </div>
          <h3>{currentModeDetails.title}</h3>
          <p>{currentModeDetails.description}</p>
          <div className="suggested-starters">
            {currentModeDetails.starters.map((topic, i) => (
              <button 
                key={i} 
                className="starter-chip"
                onClick={() => onSelectStarter(topic)}
                type="button"
              >
                <span>{topic}</span>
                <ArrowRight size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const textContent = msg.spokenText || msg.content;

            return (
              <div 
                key={index} 
                className={`message-wrapper ${msg.role}`}
              >
                <div className="message-sender-meta">
                  {isUser ? (
                    <>
                      <User size={12} />
                      <span>{currentModeDetails.userLabel}</span>
                    </>
                  ) : (
                    <>
                      <Bot size={12} />
                      <span>{currentModeDetails.speakerLabel}</span>
                    </>
                  )}
                  {msg.timestamp && (
                    <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>

                <div className="message-bubble">
                  {textContent}
                </div>

                {!isUser && (
                  <div className="message-footer">
                    <button 
                      className="replay-audio-btn"
                      onClick={() => handleCopy(textContent, index)}
                      title="Copy text"
                      type="button"
                    >
                      {copiedIndex === index ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                      <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button 
                      className="replay-audio-btn"
                      onClick={() => onReplayMessage(textContent)}
                      title="Replay Voice"
                      type="button"
                    >
                      <Volume2 size={12} />
                      <span>Listen</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Live Streaming Response Bubble */}
          {streamingText && (
            <div className="message-wrapper assistant">
              <div className="message-sender-meta">
                <Bot size={12} />
                <span>{currentModeDetails.speakerLabel}</span>
              </div>
              <div className="message-bubble">
                {streamingText}
                <span className="streaming-cursor" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
