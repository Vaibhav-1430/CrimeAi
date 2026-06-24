"use client";

import { Layers, Search } from "lucide-react";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import SimilarCasesPanel from "@/components/similar/SimilarCasesPanel";
import { getFirs } from "@/services/firApi";
import type { FIR } from "@/types/fir";

export default function SimilarCasesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FIR[]>([]);
  const [selected, setSelected] = useState<FIR | null>(null);

  // Debounced FIR search for the picker.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void getFirs({ search: query.trim(), page_size: 8 })
        .then((page) => setResults(page.items))
        .catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator", "Analyst"]}>
      <AppShell title="Similar Cases">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-5xl gap-5">
              <header>
                <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-teal-400">
                  <Layers className="h-4 w-4" />
                  Intelligence
                </p>
                <h1 className="mt-1 text-3xl font-bold">Similar Case Intelligence</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Find comparable FIRs by modus operandi, location, crime type, and shared suspects
                  (TF-IDF + cosine similarity).
                </p>
              </header>

              {/* FIR picker */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search an FIR number or crime type to analyze…"
                  className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm outline-none focus:border-teal-600"
                />
                {results.length > 0 ? (
                  <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
                    {results.map((fir) => (
                      <button
                        key={fir.id}
                        type="button"
                        onClick={() => {
                          setSelected(fir);
                          setResults([]);
                          setQuery(fir.fir_number);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      >
                        <span className="font-medium text-zinc-100">{fir.fir_number}</span>
                        <span className="text-zinc-500"> · {fir.crime_type} · {fir.status}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {selected ? (
                <SimilarCasesPanel firId={selected.id} />
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
                  Search and select an FIR to find similar cases.
                </div>
              )}
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}
