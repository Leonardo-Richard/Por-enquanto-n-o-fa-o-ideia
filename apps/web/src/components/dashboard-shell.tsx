"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortal } from "@/context/portal-provider";

const nav = [
  { href: "/dashboard", label: "Painel" },
  { href: "/empresas", label: "Empresas" },
  { href: "/execucoes", label: "Execuções" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = usePortal();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-black/5 bg-black/[0.02] py-6 dark:border-white/10 dark:bg-white/[0.02] md:flex">
          <div className="px-5 pb-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
              Portal NF
            </Link>
            <p className="mt-1 truncate text-xs text-black/50 dark:text-white/45">
              {user?.email}
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2">
            {nav.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-emerald-600/15 font-medium text-emerald-900 dark:text-emerald-200"
                      : "text-black/70 hover:bg-black/[0.04] dark:text-white/65 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 pt-4">
            <Link
              href="/"
              className="block rounded-lg px-3 py-2 text-xs text-black/50 hover:bg-black/[0.04] dark:text-white/45 dark:hover:bg-white/[0.06]"
            >
              Site público
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs text-black/60 hover:bg-black/[0.04] dark:text-white/55 dark:hover:bg-white/[0.06]"
            >
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-black/5 md:hidden dark:border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold">Portal NF</span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs text-emerald-700 dark:text-emerald-400"
              >
                Sair
              </button>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
              {nav.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                      active
                        ? "bg-emerald-600/15 font-medium text-emerald-900 dark:text-emerald-200"
                        : "bg-black/[0.04] text-black/70 dark:bg-white/[0.06] dark:text-white/65"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
