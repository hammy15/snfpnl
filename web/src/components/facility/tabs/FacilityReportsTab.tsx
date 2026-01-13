import type { RefObject } from 'react';
import { ExecutiveSummary } from '../../executive/ExecutiveSummary';
import { AnnotationsPanel } from '../../annotations/AnnotationsPanel';
import { NarrativeReport, FinancialPacketGenerator } from '../../NarrativeReport';

interface FacilityReportsTabProps {
  facilityId: string;
  facilityName: string;
  periodId: string;
  packetRef: RefObject<HTMLDivElement | null>;
}

export function FacilityReportsTab({
  facilityId,
  facilityName,
  periodId,
  packetRef,
}: FacilityReportsTabProps) {
  return (
    <>
      {/* Executive Summary */}
      <ExecutiveSummary facilityId={parseInt(facilityId)} periodId={periodId} />

      {/* Notes & Annotations */}
      <div className="mt-6">
        <AnnotationsPanel
          facilityId={facilityId}
          periodId={periodId}
        />
      </div>

      {/* Narrative Report Section */}
      <div className="mt-6">
        <NarrativeReport
          context="facility"
          periodId={periodId}
          facilityId={facilityId}
          title={`${facilityName} - Detailed Narrative`}
        />
      </div>

      {/* Financial Packet Generator */}
      <div className="mt-6" ref={packetRef}>
        <FinancialPacketGenerator
          facilityId={facilityId}
          periodId={periodId}
        />
      </div>
    </>
  );
}
