/**
 * Chat input component for AI Assistant
 */

import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSend, isLoading }: ChatInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="ai-input-container">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Ask about your portfolio..."
        rows={1}
        className="ai-input"
      />
      <button
        className="send-btn"
        onClick={onSend}
        disabled={!value.trim() || isLoading}
      >
        <Send size={18} />
      </button>
    </div>
  );
}
