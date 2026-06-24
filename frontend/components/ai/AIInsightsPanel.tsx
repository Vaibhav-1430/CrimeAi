"use client";

import { Brain, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/rbac";
import { getInsights } from "@/services/aiApi";

/** AI Insights: trends, emerging patterns, repeat offenders, high-risk locations. */
export default function AIInsightsPanel() {
  const { user } = useAuth();
  const canUseAI = hasPermission(user?.role, "ai:use");

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!canUseAI) {
    return null;
  }

  const run = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getInsights();
      setContent(response.content);
    } catch {
      setError("Unable to generate insights. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-teal-400" />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">AI Insights</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Trends, emerging patterns, repeat offenders, and high-risk locations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {content ? "Regenerate" : "Generate insights"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {content ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {content}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
