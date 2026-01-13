import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import './DataUpload.css';

interface UploadResult {
  success: boolean;
  message: string;
  summary?: {
    facilitiesProcessed: number;
    periodsProcessed: number;
    financeFacts: number;
    censusFacts: number;
    occupancyFacts: number;
    kpisComputed: number;
  };
  periods?: string[];
  facilityIds?: string[];
  error?: string;
  details?: string;
}

interface UploadStatus {
  periods: { period_id: string; facility_count: number }[];
  lastComputed: string | null;
}

export function DataUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  // Fetch upload status on mount
  useState(() => {
    fetchUploadStatus();
  });

  async function fetchUploadStatus() {
    try {
      const res = await fetch('https://snfpnl.onrender.com/api/upload/status');
      if (res.ok) {
        const data = await res.json();
        setUploadStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch upload status:', err);
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadResult({
        success: false,
        message: 'Invalid file type',
        error: 'Only Excel files (.xlsx, .xls) are allowed'
      });
      showError('Invalid File', 'Only Excel files (.xlsx, .xls) are allowed');
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('https://snfpnl.onrender.com/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult({
          success: true,
          message: data.message,
          summary: data.summary,
          periods: data.periods,
          facilityIds: data.facilityIds
        });
        setSelectedFile(null);
        showSuccess('Upload Complete', data.message || 'Data uploaded successfully');
        fetchUploadStatus(); // Refresh status after successful upload
      } else {
        setUploadResult({
          success: false,
          message: 'Upload failed',
          error: data.error,
          details: data.details
        });
        showError('Upload Failed', data.error || 'Please check the file format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setUploadResult({
        success: false,
        message: 'Upload failed',
        error: 'Network error',
        details: errorMessage
      });
      showError('Network Error', 'Failed to connect to server. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="data-upload">
      <div className="upload-header">
        <h2>Upload Financial Data</h2>
        <p>Upload your monthly income statement Excel files to update facility data and KPIs</p>
      </div>

      <div className="upload-content">
        <div className="upload-section">
          <div
            className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <div className="selected-file">
                <FileSpreadsheet size={48} className="file-icon" />
                <div className="file-info">
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button
                  className="clear-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={48} className="upload-icon" />
                <p className="upload-text">
                  <strong>Click to upload</strong> or drag and drop
                </p>
                <p className="upload-hint">Excel files only (.xlsx, .xls)</p>
              </>
            )}
          </div>

          {selectedFile && !isUploading && (
            <button className="upload-btn" onClick={handleUpload}>
              <Upload size={18} />
              Upload and Process
            </button>
          )}

          {isUploading && (
            <div className="uploading-status">
              <Loader2 size={24} className="spinning" />
              <span>Processing file... This may take a minute.</span>
            </div>
          )}

          {uploadResult && (
            <div className={`upload-result ${uploadResult.success ? 'success' : 'error'}`}>
              {uploadResult.success ? (
                <>
                  <CheckCircle size={24} />
                  <div className="result-content">
                    <strong>{uploadResult.message}</strong>
                    {uploadResult.summary && (
                      <div className="result-summary">
                        <p>Processed {uploadResult.summary.facilitiesProcessed} facilities across {uploadResult.summary.periodsProcessed} periods</p>
                        <ul>
                          <li>{uploadResult.summary.financeFacts.toLocaleString()} financial records</li>
                          <li>{uploadResult.summary.censusFacts.toLocaleString()} census records</li>
                          <li>{uploadResult.summary.kpisComputed.toLocaleString()} KPIs computed</li>
                        </ul>
                        {uploadResult.periods && (
                          <p className="periods-list">
                            <strong>Periods updated:</strong> {uploadResult.periods.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={24} />
                  <div className="result-content">
                    <strong>{uploadResult.error}</strong>
                    {uploadResult.details && <p>{uploadResult.details}</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="upload-info-section">
          <div className="info-card">
            <h3><Info size={18} /> File Format Requirements</h3>
            <ul>
              <li>Excel file (.xlsx or .xls)</li>
              <li>Each facility on its own sheet</li>
              <li>Sheet names like <code>101 (Shaw)</code> or <code>405 (Alderwood)</code></li>
              <li>Standard income statement format with revenue, expenses, and census data</li>
            </ul>
          </div>

          <div className="info-card">
            <h3><FileSpreadsheet size={18} /> Current Data Status</h3>
            {uploadStatus ? (
              <div className="status-content">
                <p><strong>Periods in database:</strong></p>
                <div className="periods-grid">
                  {uploadStatus.periods.slice(0, 12).map(p => (
                    <div key={p.period_id} className="period-badge">
                      {p.period_id}
                      <span className="facility-count">{p.facility_count}</span>
                    </div>
                  ))}
                </div>
                {uploadStatus.lastComputed && (
                  <p className="last-computed">
                    Last updated: {new Date(uploadStatus.lastComputed).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p>Loading status...</p>
            )}
          </div>

          <div className="info-card warning">
            <h3><AlertCircle size={18} /> Important Notes</h3>
            <ul>
              <li>Uploading data for an existing period will <strong>replace</strong> the previous data</li>
              <li>KPIs are automatically recalculated after upload</li>
              <li>Large files may take 1-2 minutes to process</li>
              <li>Make sure your file follows the expected format</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
