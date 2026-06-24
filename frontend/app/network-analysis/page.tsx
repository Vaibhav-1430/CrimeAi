"use client";

import { AxiosError } from "axios";
import {
  Loader2,
  Network as NetworkIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import { NODE_STYLES } from "@/lib/networkLayout";
import { getDistricts } from "@/services/firApi";
import { getNetworkGraph, searchNetworkSuspects } from "@/services/networkApi";
import type { District } from "@/types/fir";
import type {
  NetworkFilters,
  NetworkGraph,
  SuspectSearchResult
} from "@/types/network";

// React Flow must run client-side only.
const NetworkGraphCanvas = dynamic(
  () => import("@/components/network/NetworkGraphCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading graph engine…
      </div>
    )
  }
);

const CRIME_TYPES = [
  "Theft",
  "Vehicle Theft",
  "Cybercrime",
  "Fraud",
  "Assault",
  "Robbery",
  "Drug Offences",
  "Murder"
];
const STATUSES = ["Open", "Under Investigation", "Chargesheet Filed", "Closed"];

export default function NetworkAnalysisPage() {
  const [filters, setFilters] = useState<NetworkFilters>({
    crime_type: "Robbery",
    include_witness_evidence: true
  });
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Suspect focus search.
  const [suspectQuery, setSuspectQuery] = useState("");
  const [suspectResults, setSuspectResults] = useState<SuspectSearchResult[]>([]);
  const [focusSuspect, setFocusSuspect] = useState<SuspectSearchResult | null>(null);

  const load = useCallback(async (activeFilters: NetworkFilters) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getNetworkGraph(activeFilters);
      setGraph(data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to build the network graph."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void getDistricts().then(setDistricts).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  // Debounced suspect search.
  useEffect(() => {
    if (suspectQuery.trim().length < 2) {
      setSuspectResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchNetworkSuspects(suspectQuery.trim())
        .then(setSuspectResults)
        .catch(() => setSuspectResults([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [suspectQuery]);

  const applyFocusSuspect = (suspect: SuspectSearchResult) => {
    setFocusSuspect(suspect);
    setSuspectResults([]);
    setSuspectQuery("");
    setFilters((current) => ({ ...current, suspect_id: suspect.id }));
  };

  const clearFocusSuspect = () => {
    setFocusSuspect(null);
    setFilters((current) => {
      const next = { ...current };
      delete next.suspect_id;
      return next;
    });
  };

  const update = (patch: NetworkFilters) =>
    setFilters((current) => ({ ...current, ...patch }));

  const stats = graph?.stats ?? {};
  const legend = useMemo(() => Object.entries(NODE_STYLES), []);

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator", "Analyst"]}>
      <AppShell title="Network Analysis">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-[1600px] gap-5">
              <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-teal-400">
                    <NetworkIcon className="h-4 w-4" />
                    Intelligence
                  </p>
                  <h1 className="mt-1 text-3xl font-bold">Criminal Network Analysis</h1>
                  <p className="mt-2 text-sm text-zinc-400">
                    Relationship graph linking FIRs, suspects, witnesses, evidence, and stations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void load(filters)}
                  className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rebuild
                </button>
              </header>

              {/* Filters */}
              <section className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 lg:grid-cols-12">
                <div className="relative lg:col-span-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  {focusSuspect ? (
                    <div className="flex h-10 items-center justify-between rounded-md border border-teal-700 bg-teal-950/40 pl-9 pr-2 text-sm">
                      <span className="truncate">Focus: {focusSuspect.name}</span>
                      <button type="button" onClick={clearFocusSuspect} aria-label="Clear focus">
                        <X className="h-4 w-4 text-zinc-400 hover:text-zinc-100" />
                      </button>
                    </div>
                  ) : (
                    <input
                      value={suspectQuery}
                      onChange={(event) => setSuspectQuery(event.target.value)}
                      placeholder="Focus on a suspect (search name)…"
                      className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
                    />
                  )}
                  {suspectResults.length > 0 ? (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
                      {suspectResults.map((suspect) => (
                        <button
                          key={suspect.id}
                          type="button"
                          onClick={() => applyFocusSuspect(suspect)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                        >
                          {suspect.name}
                          {suspect.alias ? (
                            <span className="text-zinc-500"> · {suspect.alias}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <select
                  value={filters.crime_type ?? ""}
                  onChange={(event) => update({ crime_type: event.target.value || undefined })}
                  disabled={Boolean(focusSuspect)}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm disabled:opacity-40 lg:col-span-2"
                >
                  <option value="">All crimes</option>
                  {CRIME_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={filters.status_filter ?? ""}
                  onChange={(event) => update({ status_filter: event.target.value || undefined })}
                  disabled={Boolean(focusSuspect)}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm disabled:opacity-40 lg:col-span-2"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  value={filters.district_id ?? ""}
                  onChange={(event) =>
                    update({ district_id: event.target.value ? Number(event.target.value) : undefined })
                  }
                  disabled={Boolean(focusSuspect)}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm disabled:opacity-40 lg:col-span-2"
                >
                  <option value="">All districts</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </select>
                <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={filters.include_witness_evidence ?? true}
                    onChange={(event) => update({ include_witness_evidence: event.target.checked })}
                  />
                  Witness/Evidence
                </label>
              </section>

              {error ? (
                <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {/* Stat chips + legend */}
              <div className="flex flex-wrap items-center gap-3">
                {[
                  ["FIRs", stats.firs],
                  ["Suspects", stats.suspects],
                  ["Witnesses", stats.witnesses],
                  ["Evidence", stats.evidence],
                  ["Co-accused links", stats.co_accused_links]
                ].map(([label, value]) => (
                  <span
                    key={label as string}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
                  >
                    {label}: <span className="font-semibold text-zinc-100">{value ?? 0}</span>
                  </span>
                ))}
                <div className="ml-auto flex flex-wrap gap-3">
                  {legend.map(([type, style]) => (
                    <span key={type} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="h-3 w-3 rounded-full" style={{ background: style.color }} />
                      {style.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                {/* Graph */}
                <div>
                  {isLoading ? (
                    <div className="flex h-[480px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Building network…
                    </div>
                  ) : graph && graph.nodes.length ? (
                    <NetworkGraphCanvas graph={graph} onSelectNode={setSelectedNode} />
                  ) : (
                    <div className="flex h-[480px] items-center justify-center rounded-lg border border-dashed border-zinc-800 text-zinc-500">
                      No connections found for these filters.
                    </div>
                  )}
                </div>

                {/* Insights side panel */}
                <aside className="grid gap-4 self-start">
                  {selectedNode ? (
                    <Panel title="Selected node">
                      <p className="text-sm font-semibold text-zinc-100">
                        {String(selectedNode.data?.label ?? "")}
                      </p>
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                        {String(selectedNode.data?.nodeType ?? "")}
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-xs text-zinc-400">
                        {JSON.stringify(selectedNode.data?.meta ?? {}, null, 2)}
                      </pre>
                    </Panel>
                  ) : null}

                  <Panel title="Crime Groups" icon={<Users className="h-4 w-4" />}>
                    {graph?.crime_groups.length ? (
                      <ul className="grid gap-2">
                        {graph.crime_groups.slice(0, 6).map((group, index) => (
                          <li key={index} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
                            <p className="text-xs font-semibold text-red-400">
                              Group of {group.size}
                            </p>
                            <p className="truncate text-xs text-zinc-400">
                              {group.members.map((m) => m.name).join(", ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty text="No co-offender groups in scope." />
                    )}
                  </Panel>

                  <Panel title="Most Connected" icon={<NetworkIcon className="h-4 w-4" />}>
                    {graph?.most_connected.length ? (
                      <ul className="grid gap-1.5">
                        {graph.most_connected.slice(0, 8).map((suspect) => (
                          <li
                            key={suspect.suspect_id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="truncate text-zinc-300">{suspect.name}</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                              {suspect.connections}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty text="No connected suspects in scope." />
                    )}
                  </Panel>

                  <Panel title="Repeat Offenders" icon={<ShieldAlert className="h-4 w-4" />}>
                    {graph?.repeat_offenders.length ? (
                      <ul className="grid gap-1.5">
                        {graph.repeat_offenders.slice(0, 8).map((offender) => (
                          <li
                            key={offender.suspect_id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="truncate text-zinc-300">{offender.name}</span>
                            <span className="rounded bg-red-950 px-1.5 py-0.5 text-xs text-red-300">
                              {offender.fir_count_total} FIRs
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty text="No repeat offenders in scope." />
                    )}
                  </Panel>
                </aside>
              </div>
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Panel({
  title,
  icon,
  children
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-zinc-500">{text}</p>;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
