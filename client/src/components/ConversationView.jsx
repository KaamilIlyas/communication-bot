import React, { useRef, useEffect } from 'react';
import { MessageSquare, Sparkles, Volume2, CheckCircle2, User, Bot } from 'lucide-react';

export function ConversationView({ 
  messages, 
  streamingText, 
  onSelectStarter,
  onReplayMessage 
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const starters = [
    "Tell me about your favorite travel destination!",
    "Let's practice ordering food at a cozy cafe.",
    "What are your thoughts on recent AI breakthroughs?",
    "Help me practice for an English job interview."
  ];

  return (
    <div className="messages-container" ref={scrollRef}>
      {messages.length === 0 && !streamingText ? (
        <div className="empty-chat-state">
          <div className="empty-chat-icon">
            <MessageSquare size={32} />
          </div>
          <h3>Ready for English Conversation</h3>
          <p>
            Press and hold the microphone below or click one of the conversational topics to start speaking!
          </p>
          <div className="suggested-starters">
            {starters.map((topic, i) => (
              <button 
                key={i} 
                className="starter-chip"
                onClick={() => onSelectStarter(topic)}
              >
                <Sparkles size={13} style={{ marginRight: 5, color: 'var(--accent-primary)' }} />
                {topic}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message-wrapper ${msg.role}`}
            >
              <div className="message-sender-meta">
                {msg.role === 'user' ? (
                  <>
                    <User size={12} />
                    <span>You</span>
                  </>
                ) : (
                  <>
                    <Bot size={12} />
                    <span>Gemma 3</span>
                  </>
                )}
                {msg.timestamp && (
                  <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>

              <div className="message-bubble">
                {msg.role === 'assistant' ? msg.spokenText || msg.content : msg.content}

                {/* Inline English Practice Coach Tip */}
                {msg.correction && (
                  <div className="correction-banner">
                    <div className="correction-title">
                      <CheckCircle2 size={14} />
                      <span>English Coach Tip</span>
                    </div>
                    <div className="correction-comparison">
                      <span className="bad-text">{msg.correction.original}</span>
                      <span>→</span>
                      <span className="good-text">{msg.correction.corrected}</span>
                    </div>
                    {msg.correction.explanation && (
                      <div className="correction-explanation">
                        {msg.correction.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'assistant' && (
                <div className="message-footer">
                  <button 
                    className="replay-audio-btn"
                    onClick={() => onReplayMessage(msg.spokenText || msg.content)}
                    title="Replay Voice"
                  >
                    <Volume2 size={13} />
                    <span>Listen</span>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Live Streaming Response Bubble */}
          {streamingText && (
            <div className="message-wrapper assistant">
              <div className="message-sender-meta">
                <Bot size={12} />
                <span>Gemma 3 (Speaking...)</span>
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
