import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function DistrictsPage() {
  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin"]}>
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <h1 className="text-2xl font-bold">Districts</h1>
    </main>
    </ProtectedRoute>
  );
}
