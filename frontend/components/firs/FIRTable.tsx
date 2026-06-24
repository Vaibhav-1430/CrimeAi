import Link from "next/link";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/Skeleton";
import type { District, FIR, PoliceStation } from "@/types/fir";

interface FIRTableProps {
  firs: FIR[];
  districts: District[];
  policeStations: PoliceStation[];
  isLoading: boolean;
  deletingId: number | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (fir: FIR) => void;
  onDelete: (fir: FIR) => void;
}

export default function FIRTable({
  firs,
  districts,
  policeStations,
  isLoading,
  deletingId,
  canEdit,
  canDelete,
  onEdit,
  onDelete
}: FIRTableProps) {
  const districtById = new Map(districts.map((district) => [district.id, district.name]));
  const stationById = new Map(
    policeStations.map((station) => [station.id, station.name])
  );

  if (isLoading) {
    return <TableSkeleton rows={10} columns={canEdit || canDelete ? 7 : 6} />;
  }

  if (firs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
          No FIR records found
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create a FIR or adjust search and status filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">FIR Number</th>
              <th className="px-4 py-3">Crime Type</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Police Station</th>
              <th className="px-4 py-3">Incident Date</th>
              <th className="px-4 py-3">Status</th>
              {(canEdit || canDelete) ? (
                <th className="px-4 py-3 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {firs.map((fir) => (
              <tr
                key={fir.id}
                className="text-zinc-800 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950 dark:text-zinc-100">
                  <Link
                    href={`/firs/${fir.id}`}
                    className="text-teal-700 hover:underline dark:text-teal-400"
                  >
                    {fir.fir_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{fir.crime_type}</td>
                <td className="px-4 py-3">
                  {districtById.get(fir.district_id) ?? `District #${fir.district_id}`}
                </td>
                <td className="px-4 py-3">
                  {stationById.get(fir.police_station_id) ??
                    `Station #${fir.police_station_id}`}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {formatDate(fir.incident_date)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      fir.status === "Open"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : fir.status === "Under Investigation"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : fir.status === "Chargesheet Filed"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {fir.status}
                  </span>
                </td>
                {(canEdit || canDelete) ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(fir)}
                          title="Edit FIR"
                          aria-label={`Edit FIR ${fir.fir_number}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => onDelete(fir)}
                          disabled={deletingId === fir.id}
                          title="Delete FIR"
                          aria-label={`Delete FIR ${fir.fir_number}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          {deletingId === fir.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}
