import { AxiosError } from "axios";
import { Link2, Loader2, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { addSuspect, getSuspects, linkSuspectToFir } from "@/services/caseApi";
import type { Suspect, SuspectPayload } from "@/types/case";

interface SuspectManagerProps {
  firId: number;
  suspects: Suspect[];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}

const emptySuspect: SuspectPayload = {
  name: "",
  alias: "",
  age: "",
  notes: ""
};

export default function SuspectManager({
  firId,
  suspects,
  canEdit,
  onRefresh
}: SuspectManagerProps) {
  const [form, setForm] = useState<SuspectPayload>(emptySuspect);
  const [availableSuspects, setAvailableSuspects] = useState<Suspect[]>([]);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadSuspects() {
      try {
        const items = await getSuspects();
        setAvailableSuspects(items);
      } catch {
        setAvailableSuspects([]);
      }
    }

    void loadSuspects();
  }, [suspects]);

  const linkableSuspects = availableSuspects.filter(
    (candidate) => !suspects.some((suspect) => suspect.id === candidate.id)
  );

  const handleAddSuspect = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await addSuspect(firId, form);
      setForm(emptySuspect);
      await onRefresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to add suspect."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkSuspect = async () => {
    if (!selectedSuspectId) {
      setErrorMessage("Select a suspect to link.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await linkSuspectToFir(firId, Number(selectedSuspectId));
      setSelectedSuspectId("");
      await onRefresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to link suspect."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          Suspects
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Add new suspects or link existing ones to the FIR.
        </p>
      </div>

      {canEdit ? (
        <div className="mb-5 grid gap-4">
          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Suspect name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              placeholder="Alias"
              value={form.alias}
              onChange={(event) => setForm({ ...form, alias: event.target.value })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              placeholder="Age"
              value={form.age}
              onChange={(event) => setForm({ ...form, age: event.target.value })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <textarea
              rows={3}
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleAddSuspect()}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
              Add Suspect
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={selectedSuspectId}
              onChange={(event) => setSelectedSuspectId(event.target.value)}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Link existing suspect</option>
              {linkableSuspects.map((suspect) => (
                <option key={suspect.id} value={suspect.id}>
                  {suspect.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleLinkSuspect()}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Link2 className="h-4 w-4" />
              Link Suspect
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {suspects.length ? (
          suspects.map((suspect) => (
            <div
              key={suspect.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                {suspect.name}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {suspect.alias ? `Alias: ${suspect.alias}` : "No alias"}{" "}
                {suspect.age !== null ? `• Age: ${suspect.age}` : ""}
              </p>
              {suspect.notes ? (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {suspect.notes}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No suspects linked to this FIR yet.
          </p>
        )}
      </div>
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}
