import type { ChatMessage, GrantCategory } from './useChat';
import { GrantCard } from './GrantCard';
import './chat.css';

interface Props {
  message: ChatMessage;
  onGrantDetail?: (id: string) => void;
  onRefinement?: (text: string) => void;
  onCategoryClick?: (category: GrantCategory) => void;
}

export function MessageBubble({ message, onGrantDetail, onRefinement, onCategoryClick }: Props) {
  const time = message.timestamp.toLocaleTimeString('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`chat-bubble ${message.role}`}>
      <div className="chat-bubble-text">{message.text}</div>
      
      {/* Grant Cards */}
      {message.grants?.map((g) => (
        <GrantCard key={g.id} grant={g} onDetail={onGrantDetail} />
      ))}
      
      {/* Category Buttons (NEW) */}
      {message.categories && message.categories.length > 0 && (
        <div className="chat-categories">
          <div className="chat-categories-label">Špecifikovať podľa:</div>
          <div className="chat-categories-buttons">
            {message.categories.map((cat) => (
              <button
                key={cat.name}
                className="chat-category-btn"
                onClick={() => onCategoryClick?.(cat)}
                title={`${cat.count} výziev`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Legacy Refinement Options */}
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
