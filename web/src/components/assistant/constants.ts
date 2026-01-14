/**
 * Constants for the AI Assistant component
 */

import type { BotSettings } from './types';

export const PERSONALITY_PROMPTS: Record<string, string> = {
  professional: 'You are a professional financial analyst. Be formal, precise, and data-driven.',
  friendly: 'You are a helpful financial advisor. Be warm, approachable, and explain concepts clearly.',
  concise: 'You are an executive briefing assistant. Be extremely concise and focus only on key points.',
  detailed: 'You are a thorough financial consultant. Provide comprehensive analysis with context.',
};

export const DEFAULT_SETTINGS: BotSettings = {
  personality: 'friendly',
  focusAreas: ['margins', 'labor', 'revenue'],
  alertThresholds: {
    operatingMargin: 5,
    contractLabor: 15,
    skilledMix: 15,
    occupancy: 85,
    revenuePPD: 380,
    expensePPD: 400,
    nursingHPRD: 3.5,
    agencyNursing: 20,
  },
};

export const FOCUS_AREA_OPTIONS = ['margins', 'labor', 'revenue', 'census', 'payer mix', 'costs'];

export const PERSONALITY_OPTIONS = ['professional', 'friendly', 'concise', 'detailed'] as const;

export const INITIAL_MESSAGE = {
  id: '1',
  role: 'assistant' as const,
  content: "Hello! I'm your SNFPNL Financial Intelligence assistant. I can help you analyze your SNF portfolio, identify trends, and spot opportunities for improvement. What would you like to explore?",
  timestamp: new Date(),
};
