import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, HelpCircle, BarChart3, Building2, Map, FileSpreadsheet, Star, Keyboard, Brain, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import './UserGuide.css';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
  image?: string;
}

const guideSteps: GuideStep[] = [
  {
    title: 'Welcome to SNFPNL',
    description: 'Your comprehensive SNF Financial Intelligence platform. This guide will walk you through all the powerful features available to help you analyze and understand your facility performance.',
    icon: <HelpCircle size={32} />,
    tips: [
      'Use this guide anytime by clicking the "?" button in the header',
      'Press "?" on your keyboard for quick access to shortcuts',
      'The AI Assistant can answer questions about your data'
    ]
  },
  {
    title: 'Dashboard Overview',
    description: 'The Dashboard gives you a bird\'s-eye view of your entire portfolio. See key metrics, trends, and alerts at a glance.',
    icon: <BarChart3 size={32} />,
    tips: [
      'Portfolio T12M shows trailing 12-month performance trends',
      'Click any metric card to drill down into details',
      'Use the period selector in the header to change the reporting period',
      'Red/green indicators show performance vs. prior period'
    ]
  },
  {
    title: 'Facilities List',
    description: 'Browse, search, and filter all your facilities. Quickly find the building you need and access detailed analytics.',
    icon: <Building2 size={32} />,
    tips: [
      'Use tabs (SNF, ALF, ILF) to filter by facility type',
      'Click the star to add facilities to your favorites',
      'Click the trash icon to remove a facility',
      'Search by name, ID, or location',
      'Filter by state using the dropdown'
    ]
  },
  {
    title: 'Facility Detail View',
    description: 'Deep dive into individual facility performance. View KPIs, trends, correlations, and AI-powered insights.',
    icon: <TrendingUp size={32} />,
    tips: [
      'KPI cards show current values with trend indicators',
      'Expand sections to see detailed charts and analysis',
      'T12M Analysis shows 12-month performance with high/low points',
      'Correlations reveal relationships between metrics',
      'Click any chart to interact and see detailed data'
    ]
  },
  {
    title: 'Correlation Insights',
    description: 'Understand how different metrics relate to each other. Discover opportunities and warnings based on data patterns.',
    icon: <Target size={32} />,
    tips: [
      '"Move Together" means both metrics rise and fall together',
      '"Up/Down" means metrics move in opposite directions',
      'Green insights are opportunities to leverage',
      'Red insights are warnings to address',
      'Scatter plots visualize the relationship strength'
    ]
  },
  {
    title: 'Interactive Map',
    description: 'Visualize your facilities geographically. See performance metrics overlaid on a map for regional analysis.',
    icon: <Map size={32} />,
    tips: [
      'Color coding shows performance levels',
      'Click markers to see facility details',
      'Use the metric selector to change what\'s displayed',
      'Zoom and pan to focus on specific regions'
    ]
  },
  {
    title: 'Excel Export',
    description: 'Export your data to Excel for further analysis, reporting, or sharing with stakeholders.',
    icon: <FileSpreadsheet size={32} />,
    tips: [
      'Click the download icon in the header',
      'Choose what data to include in the export',
      'Exports include multiple sheets (Summary, Facilities, KPIs)',
      'Single facility exports available from detail pages'
    ]
  },
  {
    title: 'Favorites',
    description: 'Mark frequently accessed facilities as favorites for quick access. Your favorites persist across sessions.',
    icon: <Star size={32} />,
    tips: [
      'Click the star on any facility card to favorite it',
      'Use the "Favorites" filter to show only starred facilities',
      'Favorites are saved in your browser',
      'Great for tracking your key buildings'
    ]
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Power users can navigate quickly using keyboard shortcuts. Access any section instantly.',
    icon: <Keyboard size={32} />,
    tips: [
      'Press "?" to see all available shortcuts',
      'Cmd/Ctrl + K opens facility search',
      'Cmd/Ctrl + J toggles the AI Assistant',
      'Alt + 1-9 navigates between sections',
      'Alt + T toggles dark/light theme'
    ]
  },
  {
    title: 'AI Assistant',
    description: 'Ask questions about your data in natural language. Get instant insights, comparisons, and recommendations.',
    icon: <Brain size={32} />,
    tips: [
      'Click the chat icon or press Cmd/Ctrl + J',
      'Ask questions like "Which facility has the best margin?"',
      'Request comparisons: "Compare Boswell to North Park"',
      'Get explanations: "Why is occupancy declining?"',
      'The AI has access to all your facility data'
    ]
  },
  {
    title: 'Alerts & Warnings',
    description: 'Stay informed about important changes and potential issues across your portfolio.',
    icon: <AlertTriangle size={32} />,
    tips: [
      'Dashboard shows alert counts by severity',
      'Click alerts to see affected facilities',
      'Set custom thresholds for KPI alerts',
      'High volatility warnings help identify unstable metrics',
      'Review alerts regularly to catch issues early'
    ]
  }
];

export function UserGuide({ isOpen, onClose }: UserGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = guideSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === guideSteps.length - 1;

  const handleNext = () => {
    if (!isLast) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep(currentStep - 1);
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <div className="user-guide-overlay" onClick={handleClose}>
      <div className="user-guide-modal" onClick={(e) => e.stopPropagation()}>
        <button className="user-guide-close" onClick={handleClose}>
          <X size={20} />
        </button>

        <div className="user-guide-progress">
          {guideSteps.map((_, idx) => (
            <button
              key={idx}
              className={`progress-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(idx)}
              title={guideSteps[idx].title}
            />
          ))}
        </div>

        <div className="user-guide-content">
          <div className="user-guide-icon">{step.icon}</div>
          <h2>{step.title}</h2>
          <p className="user-guide-description">{step.description}</p>

          <div className="user-guide-tips">
            <h4>Pro Tips:</h4>
            <ul>
              {step.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="user-guide-footer">
          <div className="user-guide-step-count">
            {currentStep + 1} of {guideSteps.length}
          </div>
          <div className="user-guide-nav">
            <button
              className="guide-nav-btn"
              onClick={handlePrev}
              disabled={isFirst}
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            {isLast ? (
              <button className="guide-nav-btn primary" onClick={handleClose}>
                Get Started
              </button>
            ) : (
              <button className="guide-nav-btn primary" onClick={handleNext}>
                Next
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
