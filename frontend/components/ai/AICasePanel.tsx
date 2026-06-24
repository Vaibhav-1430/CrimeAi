"use client";

import { Check, Copy, FileText, Loader2, Scale, Search, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import ExplainabilityPanel from "@/components/ai/ExplainabilityPanel";
import { hasPermission } from "@/lib/rbac";
import {
  askAssistant,
  explainCase,
  findRelatedCases,
  generateReport,
  summarizeFir
} from "@/services/aiApi";
import type { AIExplainResponse, ReportType } from "@/types/ai";

interface AICasePanelProps {
  firId: number;
}

type Tool = "summary" | "assistant" | "related" | "report" | "explain";

/** FIR-scoped AI tools: summarize, assistant Q&A, related cases, report generator. */
export default function AICasePanel({ firId }: AICasePanelProps) {
  const { user } = useAuth();
  const canUseAI = hasPermission(user?.role, "ai:use");

  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [explanation, setExplanation] = useState<AIExplainResponse | null>(null);
  const [reportType, setReportType] = useState<ReportType>("investigation");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  if (!canUseAI) {
    return null;
  }

  const run = async (tool: Tool) => {
    setActiveTool(tool);
    setIsLoading(true);
    setOutput("");
    setExplanation(null);
    setError("");
    try {
      if (tool === "explain") {
        setExplanation(await explainCase(firId));
      } else {
        const response =
          tool === "summary"
            ? await summarizeFir(firId)
            : tool === "assistant"
              ? await askAssistant(firId)
              : tool === "related"
                ? await findRelatedCases(firId)
                : await generateReport(firId, reportType);
        setOutput(response.content);
      }
    } catch {
      setError("AI request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const tools: Array<{ key: Tool; label: string; icon: typeof Sparkles }> = [
    { key: "summary", label: "Summarize FIR", icon: Sparkles },
    { key: "assistant", label: "Investigation Help", icon: Search },
    { key: "related", label: "Related Cases", icon: Users },
    { key: "report", label: "Generate Report", icon: FileText },
    { key: "explain", label: "Explain (XAI)", icon: Scale }
  ];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">AI Assistant</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => void run(tool.key)}
              disabled={isLoading}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition disabled:opacity-50 ${
                activeTool === tool.key
                  ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tool.label}
            </button>
          );
        })}
      </div>

      {activeTool === "report" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(["investigation", "daily_briefing", "case_summary"] as ReportType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setReportType(type);
                void run("report");
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                reportType === type
                  ? "bg-teal-700 text-white"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing case…
        </div>
      ) : explanation ? (
        <div className="mt-4">
          <ExplainabilityPanel data={explanation} />
        </div>
      ) : output ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => void copyOutput()}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {output}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
