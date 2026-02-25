import { useState, useCallback, useRef } from 'react';

const API_BASE = 'https://api.stormlevel.com';
const SESSION_KEY = 'grantbot_session_id';
const TIMEOUT_MS = 30_000;

export interface GrantCardData {
  id: string;
  title: string;
  deadline_at: string | null;
  total_allocation: number | null;
  provider: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  grants?: GrantCardData[];
  refinement_options?: string[];
  keywords?: string[];
  action?: string;
}

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useChat(onKeywords?: (keywords: string[]) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Ahoj! Som GrantBot. Napíš mi čo hľadáš (napr. "dotácie pre poľnohospodárov v Bratislave").',
      timestamp: new Date(),
    },
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: getSessionId(),
          message: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(res.status >= 500 ? 'server' : 'generic');
      }

      const data = await res.json();

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.reply || data.message || 'Nemám odpoveď.',
        timestamp: new Date(),
        keywords: data.keywords,
        action: data.action,
        grants: data.grants?.length > 0 ? data.grants : undefined,
        refinement_options: data.refinement_options?.length > 0 ? data.refinement_options : undefined,
      };
      setMessages((prev) => [...prev, botMsg]);

      // Ak máme keywords a callback, zavoláme ho
      if (data.keywords?.length > 0 && data.action === 'apply_search' && onKeywords) {
        onKeywords(data.keywords);
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      let errorText = 'Prepáčte, niečo sa pokazilo. Skúste znova.';

      if (err instanceof DOMException && err.name === 'AbortError') {
        errorText = 'Odpoveď trvá dlhšie, skúste znova.';
      } else if (err instanceof TypeError) {
        errorText = 'Prepáčte, niečo sa pokazilo. Skúste znova.';
      } else if (err instanceof Error && err.message === 'server') {
        errorText = 'Server je dočasne nedostupný.';
      }

      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: errorText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      abortRef.current = null;
      setIsTyping(false);
    }
  }, [onKeywords]);

  return { messages, isOpen, isTyping, toggle, sendMessage };
}
