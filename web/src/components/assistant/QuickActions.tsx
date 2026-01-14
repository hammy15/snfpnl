/**
 * Quick action buttons for AI Assistant
 */

import {
  BarChart3,
  History,
  Building2,
  Lightbulb,
  Mail,
  Target,
  AlertCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import type { Facility, QuickAction } from './types';

interface QuickActionsProps {
  selectedFacility: Facility | null;
  periodId: string;
  onSelectPrompt: (prompt: string) => void;
}

export function QuickActions({
  selectedFacility,
  periodId,
  onSelectPrompt,
}: QuickActionsProps) {
  const actions = getQuickActions(selectedFacility, periodId);

  return (
    <div className="quick-actions">
      {actions.map(action => (
        <button
          key={action.label}
          className="quick-action-btn"
          onClick={() => onSelectPrompt(action.prompt)}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

function getQuickActions(facility: Facility | null, periodId: string): QuickAction[] {
  if (facility) {
    return [
      {
        icon: <BarChart3 size={16} />,
        label: 'Full Review',
        prompt: `Give me a complete performance review of ${facility.name}`,
      },
      {
        icon: <History size={16} />,
        label: 'Trends',
        prompt: `Show me the performance trends for ${facility.name} over the past 6 months`,
      },
      {
        icon: <Building2 size={16} />,
        label: 'Peer Compare',
        prompt: `Compare ${facility.name} to other ${facility.setting} buildings`,
      },
      {
        icon: <Lightbulb size={16} />,
        label: 'Suggestions',
        prompt: `What improvements would you suggest for ${facility.name}?`,
      },
      {
        icon: <Mail size={16} />,
        label: 'Draft Email',
        prompt: `Draft an email to the leader of ${facility.name} with feedback and suggestions`,
      },
      {
        icon: <Target size={16} />,
        label: 'Benchmarks',
        prompt: `How does ${facility.name} compare to industry benchmarks?`,
      },
    ];
  }

  return [
    {
      icon: <Mail size={16} />,
      label: 'Draft Email',
      prompt: 'Draft an email report for the portfolio to send to leadership',
    },
    {
      icon: <AlertCircle size={16} />,
      label: 'Alerts',
      prompt: 'What facilities need immediate attention based on their KPIs?',
    },
    {
      icon: <TrendingUp size={16} />,
      label: 'Top Performers',
      prompt: 'Which facilities are performing best this month and why?',
    },
    {
      icon: <Target size={16} />,
      label: 'Benchmarks',
      prompt: 'How does our portfolio compare to industry benchmarks?',
    },
    {
      icon: <Building2 size={16} />,
      label: 'Peer Compare',
      prompt:
        'Compare our worst performing facilities to our best performers and suggest improvements',
    },
    {
      icon: <FileText size={16} />,
      label: 'Analysis',
      prompt: `Give me a comprehensive analysis of trends and opportunities for ${periodId}`,
    },
  ];
}
