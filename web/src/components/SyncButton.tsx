import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Check, AlertCircle, Database } from 'lucide-react';
import './SyncButton.css';

interface SyncResult {
  success: boolean;
  syncedAt: string;
  duration: string;
  currentData: {
    facilities: number;
    periods: number;
    kpiResults: number;
    latestPeriod: string;
  };
  dataQuality: {
    kpisWithData: number;
    facilitiesWithData: number;
    completeness: number;
  };
  facilityBreakdown: Record<string, number>;
}

interface SyncStatus {
  lastSync: {
    timestamp: string;
    requestedBy: string;
    summary: any;
  } | null;
  currentStatus: {
    facilities: number;
    latestPeriod: string;
  };
}

async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await fetch('https://snfpnl.onrender.com/api/sync-status');
  if (!res.ok) throw new Error('Failed to fetch sync status');
  return res.json();
}

async function triggerSync(requestedBy: string): Promise<SyncResult> {
  const res = await fetch('https://snfpnl.onrender.com/api/sync-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestedBy }),
  });
  if (!res.ok) throw new Error('Failed to sync data');
  return res.json();
}

export function SyncButton() {
  const [showDetails, setShowDetails] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 60000, // Refresh every minute
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      const userName = JSON.parse(localStorage.getItem('snfpnl_auth') || '{}').name || 'Unknown';
      return triggerSync(userName);
    },
    onSuccess: (data) => {
      setLastResult(data);
      setShowDetails(true);
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
    },
  });

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = () => {
    if (syncMutation.isPending) {
      return <RefreshCw size={18} className="spinning" />;
    }
    if (syncMutation.isError) {
      return <AlertCircle size={18} />;
    }
    if (lastResult?.success) {
      return <Check size={18} />;
    }
    return <RefreshCw size={18} />;
  };

  return (
    <div className="sync-button-container">
      <button
        className={`sync-btn ${syncMutation.isPending ? 'syncing' : ''} ${lastResult?.success ? 'success' : ''}`}
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        title="Sync All Data"
      >
        {getStatusIcon()}
        <span className="sync-label">
          {syncMutation.isPending ? 'Syncing...' : 'Sync'}
        </span>
      </button>

      {showDetails && lastResult && (
        <div className="sync-details-popup">
          <div className="sync-details-header">
            <Database size={16} />
            <span>Sync Complete</span>
            <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
          </div>
          <div className="sync-details-content">
            <div className="sync-stat">
              <span className="stat-label">Duration</span>
              <span className="stat-value">{lastResult.duration}</span>
            </div>
            <div className="sync-stat">
              <span className="stat-label">Facilities</span>
              <span className="stat-value">{lastResult.currentData.facilities}</span>
            </div>
            <div className="sync-stat">
              <span className="stat-label">Periods</span>
              <span className="stat-value">{lastResult.currentData.periods}</span>
            </div>
            <div className="sync-stat">
              <span className="stat-label">KPI Records</span>
              <span className="stat-value">{lastResult.currentData.kpiResults.toLocaleString()}</span>
            </div>
            <div className="sync-stat">
              <span className="stat-label">Latest Period</span>
              <span className="stat-value">{lastResult.currentData.latestPeriod}</span>
            </div>
            <div className="sync-stat">
              <span className="stat-label">Data Completeness</span>
              <span className="stat-value">{lastResult.dataQuality.completeness}%</span>
            </div>
            <div className="sync-breakdown">
              <span className="stat-label">By Setting:</span>
              <div className="breakdown-items">
                {Object.entries(lastResult.facilityBreakdown).map(([setting, count]) => (
                  <span key={setting} className="breakdown-item">
                    {setting}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {status?.lastSync && !showDetails && (
        <div className="sync-last-info" title={`Last sync: ${formatTimestamp(status.lastSync.timestamp)} by ${status.lastSync.requestedBy}`}>
          <span className="last-sync-dot" />
        </div>
      )}
    </div>
  );
}
