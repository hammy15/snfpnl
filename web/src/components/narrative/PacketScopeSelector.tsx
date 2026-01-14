/**
 * Scope selector for financial packet generation
 */

import { FileText, Loader2 } from 'lucide-react';
import type { PacketScope, PacketOptions } from './types';

interface PacketScopeSelectorProps {
  scope: PacketScope;
  onScopeChange: (scope: PacketScope) => void;
  selectedFacility: string;
  onFacilityChange: (id: string) => void;
  selectedState: string;
  onStateChange: (state: string) => void;
  selectedOpco: string;
  onOpcoChange: (opco: string) => void;
  options: PacketOptions | null;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function PacketScopeSelector({
  scope,
  onScopeChange,
  selectedFacility,
  onFacilityChange,
  selectedState,
  onStateChange,
  selectedOpco,
  onOpcoChange,
  options,
  isGenerating,
  onGenerate,
}: PacketScopeSelectorProps) {
  const isDisabled =
    isGenerating ||
    (scope === 'facility' && !selectedFacility) ||
    (scope === 'state' && !selectedState) ||
    (scope === 'opco' && !selectedOpco);

  return (
    <div className="packet-controls">
      <div className="scope-selector">
        <label>Report Scope</label>
        <div className="scope-buttons">
          <button
            className={scope === 'portfolio' ? 'active' : ''}
            onClick={() => onScopeChange('portfolio')}
          >
            Portfolio
          </button>
          <button
            className={scope === 'state' ? 'active' : ''}
            onClick={() => onScopeChange('state')}
          >
            By State
          </button>
          <button
            className={scope === 'opco' ? 'active' : ''}
            onClick={() => onScopeChange('opco')}
          >
            By OpCo
          </button>
          <button
            className={scope === 'facility' ? 'active' : ''}
            onClick={() => onScopeChange('facility')}
          >
            Single Facility
          </button>
        </div>
      </div>

      {scope === 'state' && options && (
        <div className="option-group">
          <label>State</label>
          <select value={selectedState} onChange={(e) => onStateChange(e.target.value)}>
            <option value="">Select a state...</option>
            {options.states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      )}

      {scope === 'opco' && options && (
        <div className="option-group">
          <label>Operating Company</label>
          <select value={selectedOpco} onChange={(e) => onOpcoChange(e.target.value)}>
            <option value="">Select an OpCo...</option>
            {options.opcos.map(opco => (
              <option key={opco} value={opco}>{opco}</option>
            ))}
          </select>
        </div>
      )}

      {scope === 'facility' && options && (
        <div className="option-group">
          <label>Facility</label>
          <select value={selectedFacility} onChange={(e) => onFacilityChange(e.target.value)}>
            <option value="">Select a facility...</option>
            {options.facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.state})</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="generate-packet-btn"
        onClick={onGenerate}
        disabled={isDisabled}
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="spin" />
            Generating Packet...
          </>
        ) : (
          <>
            <FileText size={18} />
            Generate Financial Packet
          </>
        )}
      </button>
    </div>
  );
}
