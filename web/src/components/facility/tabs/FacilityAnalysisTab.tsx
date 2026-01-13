import { AlertTriangle } from 'lucide-react';
import { T12MAnalysis } from '../../performance/T12MAnalysis';
import { CorrelationPanel } from '../../correlation/CorrelationPanel';
import { PeerComparison } from '../../comparison/PeerComparison';
import { GoalTracking } from '../../goals/GoalTracking';
import { ThresholdAlerts } from '../../alerts/ThresholdAlerts';

interface Anomaly {
  type: string;
  severity: string;
  message: string;
}

interface KPIResult {
  kpi_id: string;
  value: number | null;
}

interface FacilityAnalysisTabProps {
  facilityId: string;
  periodId: string;
  kpis: KPIResult[];
  anomalies: Anomaly[];
}

export function FacilityAnalysisTab({
  facilityId,
  periodId,
  kpis,
  anomalies,
}: FacilityAnalysisTabProps) {
  return (
    <>
      {/* Performance Analysis */}
      <div className="space-y-6">
        <T12MAnalysis facilityId={facilityId} periodId={periodId} />
        <CorrelationPanel facilityId={facilityId} periodId={periodId} />
      </div>

      {/* Peer Comparison & Goals */}
      <div className="mt-6 space-y-6">
        <PeerComparison facilityId={parseInt(facilityId)} periodId={periodId} />
        <GoalTracking
          facilityId={facilityId}
          currentKpiValues={Object.fromEntries(
            kpis.filter(k => k.value !== null).map(k => [k.kpi_id, k.value as number])
          )}
        />
      </div>

      {/* Threshold Alerts */}
      <div className="mt-6">
        <ThresholdAlerts facilityId={parseInt(facilityId)} periodId={periodId} />
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <section className="kpi-section mt-6">
          <h2 className="section-title">
            <AlertTriangle size={20} className="text-warning" />
            Data Quality Alerts
          </h2>
          <div className="anomaly-list">
            {anomalies.map((anomaly, idx) => (
              <div key={idx} className={`anomaly-item anomaly-${anomaly.severity}`}>
                <div className="anomaly-header">
                  <span className={`badge badge-${getSeverityBadge(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                  <span className="anomaly-type">{anomaly.type}</span>
                </div>
                <p className="anomaly-message">{anomaly.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function getSeverityBadge(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'high': return 'danger';
    case 'medium': return 'warning';
    default: return 'info';
  }
}
