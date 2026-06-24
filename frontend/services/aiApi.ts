import api, { API_BASE_URL } from "@/services/api";
import { getAccessToken } from "@/services/tokenStorage";
import type {
  AIExplainResponse,
  AISearchResult,
  AIStatus,
  AITextResponse,
  ReportType
} from "@/types/ai";

export async function getAIStatus(): Promise<AIStatus> {
  const response = await api.get<AIStatus>("/ai/status");
  return response.data;
}

export async function summarizeFir(firId: number): Promise<AITextResponse> {
  const response = await api.post<AITextResponse>("/ai/summarize", { fir_id: firId });
  return response.data;
}

export async function askAssistant(
  firId: number,
  question?: string
): Promise<AITextResponse> {
  const response = await api.post<AITextResponse>("/ai/assistant", {
    fir_id: firId,
    question
  });
  return response.data;
}

export async function findRelatedCases(firId: number): Promise<AITextResponse> {
  const response = await api.post<AITextResponse>("/ai/related", { fir_id: firId });
  return response.data;
}

export async function explainCase(
  firId: number,
  question?: string
): Promise<AIExplainResponse> {
  const response = await api.post<AIExplainResponse>("/ai/explain", {
    fir_id: firId,
    question
  });
  return response.data;
}

export interface TranslateResult {
  text: string;
  translated: boolean;
  note: string;
}

export async function translateText(
  text: string,
  targetLang: "en" | "hi" | "kn",
  sourceLang?: "en" | "hi" | "kn"
): Promise<TranslateResult> {
  const response = await api.post<TranslateResult>("/ai/translate", {
    text,
    target_lang: targetLang,
    source_lang: sourceLang ?? null
  });
  return response.data;
}

export async function nlSearch(query: string): Promise<AISearchResult> {
  const response = await api.post<AISearchResult>("/ai/search", { query });
  return response.data;
}

export async function generateReport(
  firId: number,
  reportType: ReportType
): Promise<AITextResponse> {
  const response = await api.post<AITextResponse>("/ai/report", {
    fir_id: firId,
    report_type: reportType
  });
  return response.data;
}

export async function getInsights(): Promise<AITextResponse> {
  const response = await api.get<AITextResponse>("/ai/insights");
  return response.data;
}

/**
 * Stream a chat response. Calls `onChunk` as text arrives so the UI can render
 * progressively. Uses fetch (not axios) for ReadableStream access.
 */
export async function streamChat(
  message: string,
  options: {
    firId?: number;
    conversationId?: number;
    signal?: AbortSignal;
    onChunk: (text: string) => void;
  }
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include",
    body: JSON.stringify({
      message,
      fir_id: options.firId ?? null,
      conversation_id: options.conversationId ?? null
    }),
    signal: options.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    options.onChunk(decoder.decode(value, { stream: true }));
  }
}
