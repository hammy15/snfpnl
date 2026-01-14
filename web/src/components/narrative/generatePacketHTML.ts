/**
 * Generate HTML for PDF export of financial packet
 */

import { formatMarkdownSafe } from '../../utils/sanitize';
import type { FinancialPacket, PacketScope } from './types';

interface FacilitySummary {
  name: string;
  state: string;
  setting: string;
  margin: number;
  narrative: string;
  status: string;
}

export function generatePacketHTML(
  packet: FinancialPacket & { facilitySummaries?: FacilitySummary[] },
  _scope: PacketScope
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${packet.title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
        .cover { text-align: center; padding: 80px 0; page-break-after: always; }
        .cover h1 { font-size: 2.5em; color: #1a1a2e; margin-bottom: 10px; }
        .cover .subtitle { font-size: 1.3em; color: #667eea; }
        h2 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 30px; }
        h3 { color: #1a1a2e; margin-top: 25px; }
        .going-well { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .needs-work { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 1.8em; font-weight: bold; color: #1a1a2e; }
        .metric-label { font-size: 0.85em; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #667eea; color: white; }
        .positive { color: #10b981; }
        .warning { color: #f59e0b; }
        .negative { color: #ef4444; }
        .bullet { margin: 8px 0; padding-left: 20px; }
        .recommendation { background: #f0f4ff; padding: 12px 20px; margin: 8px 0; border-radius: 6px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; }
        @page { margin: 0.75in; }
        @media print { .page-break { page-break-before: always; } }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${packet.title}</h1>
        <p class="subtitle">${packet.subtitle || 'Comprehensive Financial Analysis'}</p>
        <p style="margin-top:40px">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>SNFPNL.com</p>
      </div>

      <h2>Executive Summary</h2>
      ${packet.executiveNarrative ? `<div>${formatMarkdownSafe(packet.executiveNarrative)}</div>` : ''}

      ${packet.portfolioSummary ? `
        <div class="metric-grid">
          <div class="metric-card"><div class="metric-value">${packet.portfolioSummary.totalFacilities}</div><div class="metric-label">Total Facilities</div></div>
          <div class="metric-card"><div class="metric-value">${packet.portfolioSummary.avgMargin?.toFixed(1)}%</div><div class="metric-label">Avg Margin</div></div>
          <div class="metric-card"><div class="metric-value positive">${packet.portfolioSummary.profitableFacilities}</div><div class="metric-label">Profitable</div></div>
          <div class="metric-card"><div class="metric-value negative">${packet.portfolioSummary.facilitiesAtRisk}</div><div class="metric-label">At Risk</div></div>
        </div>
      ` : ''}

      ${packet.goingWell ? `
        <div class="going-well">
          <h3>What's Going Well</h3>
          <p>${packet.goingWell.narrative}</p>
          ${packet.goingWell.bulletPoints ? packet.goingWell.bulletPoints.map((b: string) => `<div class="bullet">✓ ${b}</div>`).join('') : ''}
        </div>
      ` : ''}

      ${packet.needsWork ? `
        <div class="needs-work">
          <h3>Areas Requiring Attention</h3>
          <p>${packet.needsWork.narrative}</p>
          ${packet.needsWork.bulletPoints ? packet.needsWork.bulletPoints.map((b: string) => `<div class="bullet">⚠ ${b}</div>`).join('') : ''}
        </div>
      ` : ''}

      ${packet.facilitySummaries?.length ? `
        <div class="page-break"></div>
        <h2>Individual Facility Summaries</h2>
        <table>
          <thead>
            <tr><th>Facility</th><th>State</th><th>Type</th><th>Margin</th><th>Summary</th></tr>
          </thead>
          <tbody>
            ${packet.facilitySummaries.map((f: FacilitySummary) => `
              <tr>
                <td><strong>${f.name}</strong></td>
                <td>${f.state}</td>
                <td>${f.setting}</td>
                <td class="${f.margin >= 10 ? 'positive' : f.margin >= 0 ? 'warning' : 'negative'}">${f.margin?.toFixed(1)}%</td>
                <td>${f.narrative}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${packet.detailedNarrative ? `
        <div class="page-break"></div>
        <h2>Detailed Analysis</h2>
        <div>${formatMarkdownSafe(packet.detailedNarrative)}</div>
      ` : ''}

      ${packet.recommendations?.length ? `
        <h2>Strategic Recommendations</h2>
        ${packet.recommendations.map((r: string, i: number) => `<div class="recommendation"><strong>${i + 1}.</strong> ${r}</div>`).join('')}
      ` : ''}

      <div class="footer">
        <p>SNFPNL.com | SNF Financial Intelligence | Confidential</p>
      </div>
    </body>
    </html>
  `;
}
