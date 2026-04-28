// Shared contracts: event schema, enums, report schema (mirrored in Python via Pydantic).
export const EVENT_TYPES = ['research.started','plan.created','task.started','search.started','search.completed','source.discovered','source.extracted','evidence.created','claim.verified','coverage.updated','synthesis.started','report.completed','research.failed','research.cancelled'] as const;
export type ResearchEventType = (typeof EVENT_TYPES)[number];
export interface ResearchEvent { id: string; runId: string; seq: number; type: ResearchEventType; payload: Record<string, unknown>; createdAt: string; }
export type RunStatus = 'queued'|'running'|'completed'|'failed'|'cancelled';
export type Depth = 'quick'|'standard'|'comprehensive';
export type EvidenceRelation = 'supports'|'contradicts'|'mixed'|'insufficient'|'unverified';
export interface Citation { id: string; claimId: string; sourceId: string; evidenceId: string; passage: string; url: string; }
export interface ReportSection { heading: string; body: string; citationIds: string[]; }
export interface StructuredReport { title: string; executiveSummary: string; methodology: string; findings: ReportSection[]; comparisons: { title: string; headers: string[]; rows: string[][] }[]; contradictions: string[]; gaps: string[]; limitations: string[]; }
export const DEPTH_PRESETS: Record<Depth,{maxIterations:number;maxSearchCalls:number;maxSources:number}> = {
  quick: { maxIterations: 1, maxSearchCalls: 6, maxSources: 12 },
  standard: { maxIterations: 2, maxSearchCalls: 16, maxSources: 30 },
  comprehensive: { maxIterations: 3, maxSearchCalls: 24, maxSources: 60 },
};
