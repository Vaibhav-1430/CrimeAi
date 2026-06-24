import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function UsersPage() {
  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin"]}>
    <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <h1 className="text-2xl font-bold">Users</h1>
    </main>
    </ProtectedRoute>
  );
}
