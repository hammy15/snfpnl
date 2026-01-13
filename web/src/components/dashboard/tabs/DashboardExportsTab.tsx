import { NarrativeReport, FinancialPacketGenerator } from '../../NarrativeReport';

interface DashboardExportsTabProps {
  periodId: string;
}

export function DashboardExportsTab({ periodId }: DashboardExportsTabProps) {
  return (
    <>
      {/* Narrative Report Section */}
      <NarrativeReport
        context="dashboard"
        periodId={periodId}
        title="Dashboard Narrative Report"
      />

      {/* Financial Packet Generator */}
      <div className="mt-6">
        <FinancialPacketGenerator periodId={periodId} />
      </div>
    </>
  );
}
