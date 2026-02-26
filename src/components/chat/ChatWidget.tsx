import { useRef, useEffect } from 'react';
import { useChat, GrantCategory } from './useChat';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import './chat.css';

interface Props {
  onGrantDetail?: (id: string) => void;
  onKeywords?: (keywords: string[]) => void;
  displayedGrantIds?: string[];
}

export function ChatWidget({ onGrantDetail, onKeywords, displayedGrantIds }: Props) {
  const { messages, isOpen, isTyping, toggle, sendMessage, analyzeCategories } = useChat(onKeywords);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // When GrantViewer results change, analyze categories and show buttons
  useEffect(() => {
    if (!isOpen) return; // only when chat is open
    if (!displayedGrantIds || displayedGrantIds.length === 0) return;
    // Analyze categories for currently displayed grants
    analyzeCategories(displayedGrantIds);
  }, [displayedGrantIds, isOpen, analyzeCategories]);

  const handleCategoryClick = (cat: GrantCategory) => {
    // Send category as refinement message, which triggers new keyword extraction
    sendMessage(cat.name);
  };

  return (
    <>
      {/* Floating button */}
      <button className="chat-fab" onClick={toggle} aria-label="Chat">
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="chat-panel-header">
          <span className="chat-panel-title">🤖 GrantBot</span>
          <button className="chat-panel-close" onClick={toggle} aria-label="Zavrieť">✕</button>
        </div>
        <div className="chat-messages" ref={listRef}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onGrantDetail={onGrantDetail}
              onRefinement={sendMessage}
              onCategoryClick={handleCategoryClick}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
        <ChatInput onSend={sendMessage} disabled={isTyping} />
      </div>
    </>
  );
}
