import type { ChatMessage } from './useChat';
import { GrantCard } from './GrantCard';
import './chat.css';

interface Props {
  message: ChatMessage;
  onGrantDetail?: (id: string) => void;
  onRefinement?: (text: string) => void;
}

export function MessageBubble({ message, onGrantDetail, onRefinement }: Props) {
  const time = message.timestamp.toLocaleTimeString('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`chat-bubble ${message.role}`}>
      <div className="chat-bubble-text">{message.text}</div>
      {message.grants?.map((g) => (
        <GrantCard key={g.id} grant={g} onDetail={onGrantDetail} />
      ))}
      {message.refinement_options && message.refinement_options.length > 0 && (
        <div className="chat-refinement-options">
          {message.refinement_options.map((opt) => (
            <button
              key={opt}
              className="chat-refinement-btn"
              onClick={() => onRefinement?.(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      <div className="chat-bubble-time">{time}</div>
    </div>
  );
}
