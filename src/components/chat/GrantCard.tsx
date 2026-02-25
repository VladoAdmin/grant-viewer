import type { GrantCardData } from './useChat';
import './chat.css';

interface Props {
  grant: GrantCardData;
  onDetail?: (id: string) => void;
}

export function GrantCard({ grant, onDetail }: Props) {
  const deadline = grant.deadline_at
    ? new Date(grant.deadline_at).toLocaleDateString('sk-SK')
    : '—';
  const allocation = grant.total_allocation
    ? `${(grant.total_allocation / 1_000_000).toFixed(1)} mil. €`
    : '—';

  return (
    <div className="grant-card-chat">
      <div className="grant-card-title">{grant.title}</div>
      <div className="grant-card-meta">
        <span>📅 {deadline}</span>
        <span>💰 {allocation}</span>
        {grant.provider && <span>🏛️ {grant.provider}</span>}
      </div>
      {onDetail && (
        <button className="grant-card-btn" onClick={() => onDetail(grant.id)}>
          Zobraziť detail
        </button>
      )}
    </div>
  );
}
