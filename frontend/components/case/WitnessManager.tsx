import { AxiosError } from "axios";
import { Loader2, Pencil, Save, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { addWitness, updateWitness } from "@/services/caseApi";
import type { Witness, WitnessPayload } from "@/types/case";

interface WitnessManagerProps {
  firId: number;
  witnesses: Witness[];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}

const emptyWitness: WitnessPayload = {
  name: "",
  contact_number: "",
  statement: "",
  address: ""
};

export default function WitnessManager({
  firId,
  witnesses,
  canEdit,
  onRefresh
}: WitnessManagerProps) {
  const [form, setForm] = useState<WitnessPayload>(emptyWitness);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (editingId) {
        await updateWitness(firId, editingId, form);
      } else {
        await addWitness(firId, form);
      }

      setForm(emptyWitness);
      setEditingId(null);
      await onRefresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to save witness."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          Witnesses
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Record witness contact details and statements.
        </p>
      </div>

      {canEdit ? (
        <div className="mb-5 grid gap-3">
          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Witness name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              placeholder="Contact number"
              value={form.contact_number}
              onChange={(event) => setForm({ ...form, contact_number: event.target.value })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <textarea
              rows={3}
              placeholder="Statement"
              value={form.statement}
              onChange={(event) => setForm({ ...form, statement: event.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 md:col-span-2"
            />
            <textarea
              rows={2}
              placeholder="Address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 md:col-span-2"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Save className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {editingId ? "Update Witness" : "Add Witness"}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyWitness);
                  setErrorMessage("");
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {witnesses.length ? (
          witnesses.map((witness) => (
            <div
              key={witness.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                    {witness.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {witness.contact_number}
                  </p>
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {witness.statement}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
                    {witness.address}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(witness.id);
                      setForm({
                        name: witness.name,
                        contact_number: witness.contact_number,
                        statement: witness.statement,
                        address: witness.address
                      });
                    }}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No witnesses recorded yet.
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
