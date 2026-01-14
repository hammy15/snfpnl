/**
 * Centralized API module
 *
 * Usage:
 *   import { api } from '@/api';
 *   const facilities = await api.facilities.getFacilities();
 *   const kpis = await api.kpis.getKPIs(facilityId, periodId);
 */

// Re-export client utilities
export { API_BASE, apiRequest, get, post, put, del, postForm } from './client';

// Import and re-export domain modules
import * as facilities from './facilities';
import * as kpis from './kpis';
import * as dashboard from './dashboard';
import * as analysis from './analysis';
import * as alerts from './alerts';
import * as ai from './ai';
import * as reports from './reports';
import * as annotations from './annotations';
import * as data from './data';

// Grouped API namespace
export const api = {
  facilities,
  kpis,
  dashboard,
  analysis,
  alerts,
  ai,
  reports,
  annotations,
  data,
};

// Also export individual modules for tree-shaking
export { facilities, kpis, dashboard, analysis, alerts, ai, reports, annotations, data };

// Re-export types
export type { Facility, FacilityDirectory } from './facilities';
export type { KPI, KPITrend, KPIDrilldown, CustomKPI, KPIGoal } from './kpis';
export type { DashboardData, Period, FinancialSummary, ExecutiveSummary, LeaderboardData, SparklineData } from './dashboard';
export type {
  ComparisonResult,
  PeerComparisonData,
  BenchmarkData,
  WaterfallData,
  MarginWaterfallData,
  BudgetVsActualData,
  ForecastData,
  BreakEvenData,
  FinancialRatios,
  CohortData,
  HeatmapData,
  WhatIfResult,
  SimulationBaseline
} from './analysis';
export type { Alert, Anomaly, SmartAlert, PortfolioAlerts } from './alerts';
export type {
  NarrativeSection,
  GeneratedNarrative,
  FinancialPacketOptions,
  FinancialPacket,
  AIInsights,
  ChatMessage,
  ChatResponse,
  NaturalQueryResult
} from './ai';
export type { ScheduledReport, ActionItem, ExportParams } from './reports';
export type { Annotation, AnnotationParams } from './annotations';
export type { UploadStatus, UploadResult, SyncStatus, MapData } from './data';
