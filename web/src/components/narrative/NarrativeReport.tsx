/**
 * Simple narrative report generator
 */

import { useState } from 'react';
import { FileText, Download, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { api } from '../../api';
import type { NarrativeReportProps, GeneratedNarrative } from './types';

export function NarrativeReport({ context, periodId, facilityId, data, title }: NarrativeReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [narrative, setNarrative] = useState<GeneratedNarrative | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const formatPeriod = (periodId: string): string => {
    const [year, month] = periodId.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const generateNarrative = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await api.ai.generateNarrative({
        context,
        periodId,
        facilityId,
        data,
      });
      setNarrative(result as unknown as GeneratedNarrative);
      setIsExpanded(true);
    } catch (err) {
      setError('Failed to generate narrative. Please try again.');
      console.error('Narrative generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async () => {
    if (!narrative) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${narrative.title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
            line-height: 1.6;
          }
          h1 {
            color: #1a1a2e;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
          }
          h2 {
            color: #667eea;
            margin-top: 30px;
          }
          .metadata {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 0.9em;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-summary { border-left: 4px solid #667eea; padding-left: 15px; }
          .section-analysis { border-left: 4px solid #00d9a5; padding-left: 15px; }
          .section-trends { border-left: 4px solid #f093fb; padding-left: 15px; }
          .section-recommendations { border-left: 4px solid #ffc107; padding-left: 15px; }
          .section-questions { border-left: 4px solid #ff4757; padding-left: 15px; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.8em;
            color: #666;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>${narrative.title}</h1>
        <div class="metadata">
          <strong>Generated:</strong> ${new Date(narrative.generatedAt).toLocaleString()}<br>
          <strong>Period:</strong> ${formatPeriod(narrative.metadata.periodId)}<br>
          ${narrative.metadata.facilityId ? `<strong>Facility:</strong> ${narrative.metadata.facilityId}<br>` : ''}
          <strong>Report Type:</strong> ${narrative.metadata.context.charAt(0).toUpperCase() + narrative.metadata.context.slice(1)} Analysis
        </div>
        ${narrative.sections.map(section => `
          <div class="section section-${section.type}">
            <h2>${section.title}</h2>
            <p>${section.content.replace(/\n/g, '</p><p>')}</p>
          </div>
        `).join('')}
        <div class="footer">
          <p>SNFPNL.com | Confidential Report</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToWord = () => {
    if (!narrative) return;

    const content = `
${narrative.title}
${'='.repeat(narrative.title.length)}

Generated: ${new Date(narrative.generatedAt).toLocaleString()}
Period: ${formatPeriod(narrative.metadata.periodId)}
${narrative.metadata.facilityId ? `Facility: ${narrative.metadata.facilityId}` : ''}
Report Type: ${narrative.metadata.context.charAt(0).toUpperCase() + narrative.metadata.context.slice(1)} Analysis

${'-'.repeat(50)}

${narrative.sections.map(section => `
${section.title}
${'-'.repeat(section.title.length)}

${section.content}

`).join('\n')}

---
SNFPNL.com | Confidential Report
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${narrative.title.replace(/\s+/g, '_')}_${periodId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!narrative) return;

    const content = `${narrative.title}\n\n${narrative.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n')}`;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="narrative-report">
      <div className="narrative-header">
        <div className="narrative-title">
          <FileText size={24} />
          <div>
            <h3>{title || 'Narrative Report'}</h3>
            <p>AI-generated analysis and insights</p>
          </div>
        </div>

        <div className="narrative-actions">
          {narrative && (
            <>
              <button className="action-btn" onClick={copyToClipboard} title="Copy to clipboard">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button className="action-btn" onClick={exportToWord} title="Export as Text">
                <Download size={18} />
                Text
              </button>
              <button className="action-btn" onClick={exportToPDF} title="Export as PDF">
                <Download size={18} />
                PDF
              </button>
            </>
          )}
          <button
            className={`generate-btn ${isGenerating ? 'generating' : ''}`}
            onClick={generateNarrative}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="spin" />
                Generating...
              </>
            ) : narrative ? (
              <>
                <RefreshCw size={18} />
                Regenerate
              </>
            ) : (
              <>
                <FileText size={18} />
                Generate Narrative
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="narrative-error">
          {error}
        </div>
      )}

      {narrative && isExpanded && (
        <div className="narrative-content">
          <div className="narrative-meta">
            <span>Generated {new Date(narrative.generatedAt).toLocaleString()}</span>
            <span>Period: {formatPeriod(narrative.metadata.periodId)}</span>
            {narrative.metadata.facilityId && (
              <span>Facility: {narrative.metadata.facilityId}</span>
            )}
          </div>

          <div className="narrative-sections">
            {narrative.sections.map((section, index) => (
              <div key={index} className={`narrative-section section-${section.type}`}>
                <h4>{section.title}</h4>
                <div className="section-content">
                  {section.content.split('\n').map((paragraph, pIndex) => (
                    <p key={pIndex}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative && !isExpanded && (
        <button className="expand-btn" onClick={() => setIsExpanded(true)}>
          Show Generated Narrative
        </button>
      )}
    </div>
  );
}
