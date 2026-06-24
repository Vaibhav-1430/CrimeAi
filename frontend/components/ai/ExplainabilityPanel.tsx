"use client";

import {
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Lightbulb,
  ShieldQuestion,
  User,
  Users
} from "lucide-react";
import type { AIExplainResponse } from "@/types/ai";

interface ExplainabilityPanelProps {
  data: AIExplainResponse;
}

function confidenceColor(value: number): string {
  if (value >= 66) return "#16a34a";
  if (value >= 33) return "#f59e0b";
  return "#dc2626";
}

function confidenceLabel(value: number): string {
  if (value >= 66) return "High confidence";
  if (value >= 33) return "Moderate confidence";
  if (value > 0) return "Low confidence";
  return "Unavailable";
}

/**
 * Explainability panel: AI Answer → Evidence Used → Reasoning Path →
 * Recommendation, with a confidence gauge. References are the grounded,
 * server-computed evidence trail.
 */
export default function ExplainabilityPanel({ data }: ExplainabilityPanelProps) {
  const { references } = data;

  return (
    <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Confidence gauge */}
      <div className="flex items-center gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <ConfidenceRing value={data.confidence} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {confidenceLabel(data.confidence)}
          </p>
          <p className="text-xs text-zinc-500">{data.confidence_rationale || "—"}</p>
        </div>
      </div>

      {/* 1. AI Answer */}
      <Section icon={<CheckCircle2 className="h-4 w-4" />} title="AI Response">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {data.answer}
        </p>
      </Section>

      {/* 2. Evidence Used */}
      <Section icon={<Database className="h-4 w-4" />} title="Evidence Used · Data Sources">
        <div className="flex flex-wrap gap-1.5">
          {references.data_sources.map((source) => (
            <span
              key={source}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300"
            >
              {source}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <RefList
            icon={<FileText className="h-3.5 w-3.5" />}
            label="FIR References"
            items={references.firs.map((f) => String(f.fir_number ?? f.id))}
          />
          <RefList
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Evidence References"
            items={references.evidence.map(
              (e) => `${e.file_name ?? `#${e.id}`}${e.media_type ? ` (${e.media_type})` : ""}`
            )}
          />
          <RefList
            icon={<User className="h-3.5 w-3.5" />}
            label="Suspect References"
            items={references.suspects.map((s) => String(s.name ?? `#${s.id}`))}
          />
          <RefList
            icon={<Users className="h-3.5 w-3.5" />}
            label="Witness References"
            items={references.witnesses.map((w) => String(w.name ?? `#${w.id}`))}
          />
        </div>
      </Section>

      {/* 3. Reasoning Path */}
      <Section icon={<GitBranch className="h-4 w-4" />} title="Reasoning Path">
        {data.reasoning_chain.length ? (
          <ol className="grid gap-2">
            {data.reasoning_chain.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">No reasoning chain available.</p>
        )}
      </Section>

      {/* 4. Recommendation */}
      <Section icon={<Lightbulb className="h-4 w-4" />} title="Recommendation">
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {data.recommendation || "—"}
        </p>
      </Section>

      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <ShieldQuestion className="h-3.5 w-3.5" />
        References are drawn directly from case records; AI reasoning is advisory and must be verified.
      </p>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const color = confidenceColor(value);
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle cx="34" cy="34" r={radius} fill="none" stroke="#3f3f46" strokeWidth="6" opacity={0.3} />
      <circle
        cx="34"
        cy="34"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" textAnchor="middle" className="fill-zinc-800 dark:fill-zinc-100" fontSize="15" fontWeight="700">
        {Math.round(value)}%
      </text>
    </svg>
  );
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span className="text-teal-600 dark:text-teal-400">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function RefList({
  icon,
  label,
  items
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
        {icon}
        {label}
        <span className="ml-auto rounded bg-zinc-100 px-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
          {items.length}
        </span>
      </p>
      {items.length ? (
        <ul className="grid gap-0.5">
          {items.map((item, index) => (
            <li key={index} className="truncate text-xs text-zinc-700 dark:text-zinc-300">
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-400">None</p>
      )}
    </div>
  );
}
