import './chat.css';

export function TypingIndicator() {
  return (
    <div className="chat-bubble bot">
      <div className="typing-indicator">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
