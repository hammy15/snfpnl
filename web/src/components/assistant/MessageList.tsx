/**
 * Message list display component for AI Assistant
 */

import { useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { Message } from './types';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="ai-messages">
      {messages.map(message => (
        <div key={message.id} className={`message ${message.role}`}>
          {message.role === 'assistant' && (
            <div className="message-avatar">
              <Sparkles size={14} />
            </div>
          )}
          <div className="message-content">
            <p>{message.content}</p>
            <span className="message-time">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="message assistant">
          <div className="message-avatar">
            <Sparkles size={14} />
          </div>
          <div className="message-content">
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
