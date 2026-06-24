"use client";

import { AxiosError } from "axios";
import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthFormShell from "@/components/auth/AuthFormShell";
import { signup } from "@/services/authApi";
import { getPublicDistricts, getPublicPoliceStations } from "@/services/orgApi";
import type { District, PoliceStation } from "@/types/fir";

export default function SignupPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    employee_id: "",
    mobile_number: "",
    rank: "",
    district_id: 0,
    station_id: 0,
    password: "",
    confirm_password: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadOrgData() {
      try {
        const [districtItems, stationItems] = await Promise.all([
          getPublicDistricts(),
          getPublicPoliceStations()
        ]);
        setDistricts(districtItems);
        setStations(stationItems);
        setForm((current) => ({
          ...current,
          district_id: current.district_id || districtItems[0]?.id || 0,
          station_id: current.station_id || stationItems[0]?.id || 0
        }));
      } catch {
        setErrorMessage("Unable to load district and station data.");
      }
    }

    void loadOrgData();
  }, []);

  const filteredStations = form.district_id
    ? stations.filter((station) => station.district_id === form.district_id)
    : stations;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await signup(form);
      setSuccessMessage("Onboarding request submitted. Access will be enabled after admin approval.");
      setForm({
        name: "",
        email: "",
        employee_id: "",
        mobile_number: "",
        rank: "",
        district_id: districts[0]?.id || 0,
        station_id: stations[0]?.id || 0,
        password: "",
        confirm_password: ""
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to submit onboarding request."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFormShell
      title="Officer onboarding"
      subtitle="Submit your official police credentials for administrative approval."
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Full Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <TextInput label="Official Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <TextInput label="Employee ID" value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value })} />
          <TextInput label="Mobile Number" value={form.mobile_number} onChange={(value) => setForm({ ...form, mobile_number: value })} />
          <TextInput label="Rank" value={form.rank} onChange={(value) => setForm({ ...form, rank: value })} />

          <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            District
            <select
              value={form.district_id || ""}
              onChange={(event) => {
                const districtId = Number(event.target.value);
                const nextStation = stations.find((station) => station.district_id === districtId);
                setForm({
                  ...form,
                  district_id: districtId,
                  station_id: nextStation?.id || 0
                });
              }}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {districts.map((district) => (
                <option key={district.id} value={district.id}>{district.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Police Station
            <select
              value={form.station_id || ""}
              onChange={(event) => setForm({ ...form, station_id: Number(event.target.value) })}
              className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {filteredStations.map((station) => (
                <option key={station.id} value={station.id}>{station.name}</option>
              ))}
            </select>
          </label>

          <TextInput label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          <TextInput label="Confirm Password" type="password" value={form.confirm_password} onChange={(value) => setForm({ ...form, confirm_password: value })} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Submit for Approval
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already approved?{" "}
          <Link className="font-semibold text-teal-700 dark:text-teal-400" href="/login">
            Login
          </Link>
        </p>
      </form>
    </AuthFormShell>
  );
}

function TextInput({
  label,
  type = "text",
  value,
  onChange
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
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
