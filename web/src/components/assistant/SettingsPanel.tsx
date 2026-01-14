/**
 * Settings panel for AI Assistant configuration
 */

import type { BotSettings } from './types';
import { FOCUS_AREA_OPTIONS, PERSONALITY_OPTIONS } from './constants';

interface SettingsPanelProps {
  settings: BotSettings;
  onSettingsChange: (settings: BotSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const updatePersonality = (personality: BotSettings['personality']) => {
    onSettingsChange({ ...settings, personality });
  };

  const toggleFocusArea = (area: string) => {
    const focusAreas = settings.focusAreas.includes(area)
      ? settings.focusAreas.filter(a => a !== area)
      : [...settings.focusAreas, area];
    onSettingsChange({ ...settings, focusAreas });
  };

  const updateThreshold = (key: keyof BotSettings['alertThresholds'], value: number) => {
    onSettingsChange({
      ...settings,
      alertThresholds: { ...settings.alertThresholds, [key]: value },
    });
  };

  return (
    <div className="ai-settings">
      <h4>Bot Personality</h4>
      <div className="personality-options">
        {PERSONALITY_OPTIONS.map(p => (
          <button
            key={p}
            className={`personality-btn ${settings.personality === p ? 'active' : ''}`}
            onClick={() => updatePersonality(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <h4>Focus Areas</h4>
      <div className="focus-options">
        {FOCUS_AREA_OPTIONS.map(area => (
          <button
            key={area}
            className={`focus-btn ${settings.focusAreas.includes(area) ? 'active' : ''}`}
            onClick={() => toggleFocusArea(area)}
          >
            {area}
          </button>
        ))}
      </div>

      <h4>Alert Thresholds</h4>
      <div className="threshold-options">
        <ThresholdItem
          label="Operating Margin Below"
          value={settings.alertThresholds.operatingMargin}
          unit="%"
          onChange={v => updateThreshold('operatingMargin', v)}
        />
        <ThresholdItem
          label="Occupancy Below"
          value={settings.alertThresholds.occupancy}
          unit="%"
          onChange={v => updateThreshold('occupancy', v)}
        />
        <ThresholdItem
          label="Skilled Mix Below"
          value={settings.alertThresholds.skilledMix}
          unit="%"
          onChange={v => updateThreshold('skilledMix', v)}
        />
        <ThresholdItem
          label="Revenue PPD Below"
          value={settings.alertThresholds.revenuePPD}
          unit="$"
          onChange={v => updateThreshold('revenuePPD', v)}
        />
        <ThresholdItem
          label="Expense PPD Above"
          value={settings.alertThresholds.expensePPD}
          unit="$"
          onChange={v => updateThreshold('expensePPD', v)}
        />
        <ThresholdItem
          label="Contract Labor Above"
          value={settings.alertThresholds.contractLabor}
          unit="%"
          onChange={v => updateThreshold('contractLabor', v)}
        />
        <ThresholdItem
          label="Agency Nursing Above"
          value={settings.alertThresholds.agencyNursing}
          unit="%"
          onChange={v => updateThreshold('agencyNursing', v)}
        />
        <ThresholdItem
          label="Nursing Hours PPD Below"
          value={settings.alertThresholds.nursingHPRD}
          unit="hrs"
          step={0.1}
          onChange={v => updateThreshold('nursingHPRD', v)}
        />
      </div>

      <button className="save-settings-btn" onClick={onClose}>
        Save Settings
      </button>
    </div>
  );
}

interface ThresholdItemProps {
  label: string;
  value: number;
  unit: string;
  step?: number;
  onChange: (value: number) => void;
}

function ThresholdItem({ label, value, unit, step = 1, onChange }: ThresholdItemProps) {
  return (
    <div className="threshold-item">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span>{unit}</span>
    </div>
  );
}
