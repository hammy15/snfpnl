/**
 * AI Assistant - Main orchestrator component
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Settings, Sparkles, Trash2 } from 'lucide-react';
import { fetchFacilityKPIs, fetchAllKPIs, fetchTrends } from './api';
import { generateAIResponse } from './aiService';
import { SettingsPanel } from './SettingsPanel';
import { MessageList } from './MessageList';
import { QuickActions } from './QuickActions';
import { ChatInput } from './ChatInput';
import { DEFAULT_SETTINGS, INITIAL_MESSAGE } from './constants';
import type { AIAssistantProps, Message, BotSettings } from './types';
import '../AIAssistant.css';

export function AIAssistant({
  isOpen,
  onClose,
  periodId,
  selectedFacility,
  facilities = [],
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([{ ...INITIAL_MESSAGE }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);

  // Fetch facility-specific data when a facility is selected
  const { data: facilityKPIs } = useQuery({
    queryKey: ['facilityKPIs', selectedFacility, periodId],
    queryFn: () => fetchFacilityKPIs(selectedFacility!, periodId),
    enabled: !!selectedFacility && isOpen,
  });

  // Fetch all KPIs for comparison
  const { data: allKPIs = [] } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
    enabled: isOpen,
  });

  // Fetch trend data for selected facility
  const { data: marginTrends } = useQuery({
    queryKey: ['marginTrends', selectedFacility],
    queryFn: () => fetchTrends(selectedFacility!, 'snf_operating_margin_pct'),
    enabled: !!selectedFacility && isOpen,
  });

  const selectedFacilityInfo = facilities.find(f => f.facility_id === selectedFacility) || null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateAIResponse(
        input,
        settings,
        periodId,
        selectedFacilityInfo,
        facilityKPIs || [],
        allKPIs,
        marginTrends || [],
        facilities
      );
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Chat history cleared. How can I help you analyze your portfolio?',
        timestamp: new Date(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-avatar">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>AI Assistant</h3>
            <span className="ai-status">
              <span className="status-dot" />
              {selectedFacilityInfo
                ? `Reviewing: ${selectedFacilityInfo.name}`
                : 'Portfolio Mode'}
            </span>
          </div>
        </div>
        <div className="ai-header-actions">
          <button
            className="ai-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            className="ai-btn"
            onClick={clearHistory}
            title="Clear History"
          >
            <Trash2 size={18} />
          </button>
          <button className="ai-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          <MessageList messages={messages} isLoading={isLoading} />
          <QuickActions
            selectedFacility={selectedFacilityInfo}
            periodId={periodId}
            onSelectPrompt={setInput}
          />
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
