import { Radar } from "lucide-react";
import type { ReactNode } from "react";

interface AuthFormShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthFormShell({ title, subtitle, children }: AuthFormShellProps) {
  return (
    <main className="bg-grid relative flex min-h-screen items-center justify-center px-4 py-8 text-zinc-100">
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[100px]" />

      <section className="glass-strong relative w-full max-w-md rounded-2xl p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
            <Radar className="h-5 w-5 text-white" />
            <span className="live-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">CrimeAI</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-400">
              Intelligence OS
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
