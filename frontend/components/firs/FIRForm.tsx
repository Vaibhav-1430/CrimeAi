import { Loader2, Save, X } from "lucide-react";
import { firStatusOptions } from "@/types/fir";
import type { District, FIRPayload, PoliceStation } from "@/types/fir";

interface FIRFormProps {
  value: FIRPayload;
  districts: District[];
  policeStations: PoliceStation[];
  isEditing: boolean;
  isSubmitting: boolean;
  onChange: (value: FIRPayload) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export default function FIRForm({
  value,
  districts,
  policeStations,
  isEditing,
  isSubmitting,
  onChange,
  onSubmit,
  onCancelEdit
}: FIRFormProps) {
  const filteredStations = value.district_id
    ? policeStations.filter((station) => station.district_id === value.district_id)
    : policeStations;

  const handleFieldChange = <K extends keyof FIRPayload>(
    field: K,
    fieldValue: FIRPayload[K]
  ) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const handleDistrictChange = (districtId: number) => {
    const nextStations = policeStations.filter(
      (station) => station.district_id === districtId
    );

    onChange({
      ...value,
      district_id: districtId,
      police_station_id: nextStations.some(
        (station) => station.id === value.police_station_id
      )
        ? value.police_station_id
        : nextStations[0]?.id ?? 0
    });
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            {isEditing ? "Edit FIR" : "Register FIR"}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Capture core case details, jurisdiction, and current status.
          </p>
        </div>
        {isEditing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        ) : null}
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          FIR Number
          <input
            required
            value={value.fir_number}
            onChange={(event) => handleFieldChange("fir_number", event.target.value)}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Crime Type
          <input
            required
            value={value.crime_type}
            onChange={(event) => handleFieldChange("crime_type", event.target.value)}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          District
          <select
            required
            value={value.district_id || ""}
            onChange={(event) => handleDistrictChange(Number(event.target.value))}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="" disabled>
              Select district
            </option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Police Station
          <select
            required
            value={value.police_station_id || ""}
            onChange={(event) =>
              handleFieldChange("police_station_id", Number(event.target.value))
            }
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="" disabled>
              Select police station
            </option>
            {filteredStations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Incident Date
          <input
            required
            type="date"
            value={value.incident_date}
            onChange={(event) =>
              handleFieldChange("incident_date", event.target.value)
            }
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Status
          <select
            value={value.status}
            onChange={(event) =>
              handleFieldChange("status", event.target.value as FIRPayload["status"])
            }
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {firStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 md:col-span-2">
          Description
          <textarea
            required
            rows={4}
            value={value.description}
            onChange={(event) =>
              handleFieldChange("description", event.target.value)
            }
            className="resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? "Update FIR" : "Create FIR"}
          </button>
        </div>
      </form>
    </section>
  );
}
