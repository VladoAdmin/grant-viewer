import type { ChatMessage } from './useChat';
import { GrantCard } from './GrantCard';
import './chat.css';

interface Props {
  message: ChatMessage;
  onGrantDetail?: (id: string) => void;
}

export function MessageBubble({ message, onGrantDetail }: Props) {
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
      <div className="chat-bubble-time">{time}</div>
    </div>
  );
}
