"use client";

import { Lightbulb, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSimilarCases } from "@/services/similarCasesApi";
import type { SimilarCase, SimilarCasesResult } from "@/types/similar";

interface SimilarCasesPanelProps {
  firId: number;
  /** Render heading + target block (standalone page) vs compact (embedded). */
  compact?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  Open: "text-emerald-400",
  "Under Investigation": "text-amber-400",
  "Chargesheet Filed": "text-blue-400",
  Closed: "text-zinc-400"
};

export default function SimilarCasesPanel({ firId, compact = false }: SimilarCasesPanelProps) {
  const [data, setData] = useState<SimilarCasesResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await getSimilarCases(firId, 10));
    } catch {
      setError("Unable to compute similar cases.");
    } finally {
      setIsLoading(false);
    }
  }, [firId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Computing similarity (TF-IDF + cosine)…
      </div>
    );
  }
  if (error) {
    return <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-200">{error}</div>;
  }
  if (!data) return null;

  const totalOutcomes = Object.values(data.outcome_distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-4">
      {!compact ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Target case</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{data.target.fir_number}</p>
          <p className="text-sm text-zinc-400">
            {data.target.crime_type} · {data.target.district} · {data.target.status}
          </p>
          <p className="mt-2 text-sm text-zinc-500">{data.target.description}</p>
        </div>
      ) : null}

      {/* Recommendation + outcomes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-300">
            <Lightbulb className="h-4 w-4" />
            Investigation Recommendation
          </p>
          <p className="text-sm text-amber-100/90">{data.recommendation}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-sm font-semibold text-zinc-100">Previous Outcomes</p>
          {totalOutcomes ? (
            <div className="grid gap-1.5">
              {Object.entries(data.outcome_distribution).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <span className={`w-40 ${STATUS_COLOR[status] ?? "text-zinc-300"}`}>{status}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${(count / totalOutcomes) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-zinc-400">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No comparable outcomes.</p>
          )}
        </div>
      </div>

      {/* Similar cases list */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-sm font-semibold text-zinc-100">
          Similar Cases ({data.similar.length})
        </p>
        {data.similar.length ? (
          <div className="grid gap-2">
            {data.similar.map((c) => (
              <SimilarRow key={c.fir_id} c={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No comparable cases found.</p>
        )}
      </div>
    </div>
  );
}

function SimilarRow({ c }: { c: SimilarCase }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/firs/${c.fir_id}`}
            className="text-sm font-semibold text-teal-400 hover:underline"
          >
            {c.fir_number}
          </Link>
          <p className="text-xs text-zinc-500">
            {c.crime_type} · {c.district} ·{" "}
            <span className={STATUS_COLOR[c.status] ?? "text-zinc-400"}>{c.status}</span>
          </p>
          <p className="mt-1 truncate text-xs text-zinc-400">{c.description}</p>
          {c.shared_suspects.length ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
              <Users className="h-3 w-3" />
              Shared suspects: {c.shared_suspects.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-zinc-100">{c.similarity}%</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">match</div>
        </div>
      </div>
      {/* Component breakdown */}
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
        <Chip label="MO" value={c.breakdown.text} />
        <Chip label="Crime" value={c.breakdown.crime_type} />
        <Chip label="Location" value={c.breakdown.location} />
        <Chip label="Suspects" value={c.breakdown.suspects} />
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5">
      {label} {value}%
    </span>
  );
}
