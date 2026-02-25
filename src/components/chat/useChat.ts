import { useState, useCallback } from 'react';

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
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Ahoj! Som GrantBot. Opýtaj sa ma na granty, výzvy alebo dotácie.',
      timestamp: new Date(),
    },
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const sendMessage = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simulated bot response (will be replaced with real API)
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: 'Ďakujem za otázku. Funkcia chatbotu bude čoskoro pripojená na backend.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
  }, []);

  return { messages, isOpen, isTyping, toggle, sendMessage };
}
