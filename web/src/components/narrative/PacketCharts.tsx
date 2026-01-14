/**
 * Chart components for financial packet display
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { FinancialPacket, PacketScope, ChartEntry } from './types';

interface ChartsProps {
  packet: FinancialPacket;
  scope: PacketScope;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}

export function PacketCharts({ packet, scope, expandedSections, toggleSection }: ChartsProps) {
  if (scope !== 'facility' || !packet.charts) return null;

  return (
    <div className="packet-section">
      <div className="section-header clickable" onClick={() => toggleSection('charts')}>
        <h3>
          {expandedSections.has('charts') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          Performance Visualizations
        </h3>
      </div>
      {expandedSections.has('charts') && (
        <div className="charts-grid">
          {/* Margin Trend Chart */}
          {packet.charts.marginTrend && (
            <div className="chart-container wide">
              <h4>12-Month Margin Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={packet.charts.marginTrend}>
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(val) => `${Number(val).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="margin" stroke="#667eea" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="portfolioAvg" stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Breakdown Chart */}
          {packet.charts.revenueBreakdown && (
            <div className="chart-container">
              <h4>Revenue by Payer</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={packet.charts.revenueBreakdown}
                    dataKey="pct"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {packet.charts.revenueBreakdown.map((entry: ChartEntry, idx: number) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => `${Number(val).toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Expense Breakdown Chart */}
          {packet.charts.expenseBreakdown && (
            <div className="chart-container">
              <h4>Expense Breakdown</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={packet.charts.expenseBreakdown} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(val) => `$${Number(val).toFixed(0)}`} />
                  <Bar dataKey="value" fill="#667eea" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Payer Mix Comparison */}
          {packet.charts.payerMixComparison && (
            <div className="chart-container">
              <h4>Payer Mix vs Portfolio</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={packet.charts.payerMixComparison}>
                  <XAxis dataKey="payer" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => `${Number(val).toFixed(1)}%`} />
                  <Bar dataKey="facility" fill="#667eea" name="This Facility" />
                  <Bar dataKey="portfolio" fill="#94a3b8" name="Portfolio Avg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
