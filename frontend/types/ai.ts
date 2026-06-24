import type { FIR } from "@/types/fir";

export interface AIStatus {
  live: boolean;
  model: string;
  suggested_questions: string[];
}

export interface AITextResponse {
  feature: string;
  content: string;
  live: boolean;
}

export interface AISearchResult {
  interpreted_filters: Record<string, string>;
  explanation: string;
  results: FIR[];
}

export interface ExplainabilityReferences {
  firs: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  suspects: Array<Record<string, unknown>>;
  witnesses: Array<Record<string, unknown>>;
  data_sources: string[];
}

export interface AIExplainResponse {
  feature: string;
  live: boolean;
  answer: string;
  recommendation: string;
  reasoning_chain: string[];
  confidence: number;
  confidence_rationale: string;
  references: ExplainabilityReferences;
}

export type ReportType = "investigation" | "daily_briefing" | "case_summary";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}
