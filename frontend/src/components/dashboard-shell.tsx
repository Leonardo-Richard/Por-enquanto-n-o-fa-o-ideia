"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppSession } from "@/context/app-session";
import { signOut } from "@/lib/auth-browser";

type NavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

const superadminNav: NavItem = {
  href: "/admin/organizacoes",
  label: "Organizações",
  isActive: (p) => p === "/admin/organizacoes" || p.startsWith("/admin/organizacoes/"),
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Painel",
    isActive: (p) => p === "/dashboard",
  },
  {
    href: "/empresas-monitoradas",
    label: "Empresas monitoradas",
    isActive: (p) =>
      p === "/empresas-monitoradas" || p.startsWith("/empresas-monitoradas/"),
  },
  {
    href: "/execucoes",
    label: "Execuções",
    isActive: (p) => p.startsWith("/execucoes"),
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    isActive: (p) => p.startsWith("/configuracoes"),
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data } = useAppSession();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/me", { credentials: "include" });
        const j = (await res.json().catch(() => null)) as {
          activeOrganizationName?: string | null;
          isSuperadmin?: boolean;
        } | null;
        if (!cancelled && res.ok && j) {
          setOrgName(j.activeOrganizationName ?? null);
          setIsSuperadmin(Boolean(j.isSuperadmin));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, data?.user?.id]);

  async function logout() {
    await signOut();
    window.location.href = "/login";
  }

  const email = data?.user?.email ?? "";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-black/5 bg-black/[0.02] py-6 dark:border-white/10 dark:bg-white/[0.02] md:flex">
          <div className="px-5 pb-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
              Portal NF
            </Link>
            <p className="mt-1 truncate text-xs text-black/50 dark:text-white/45">
              {email}
            </p>
            {orgName ? (
              <p className="mt-2 text-xs text-black/55 dark:text-white/50">
                Organização: <span className="font-medium text-black/75 dark:text-white/70">{orgName}</span>
              </p>
            ) : null}
            <Link
              href="/empresas"
              className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Trocar organização
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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
            {isSuperadmin ? (
              <Link
                href={superadminNav.href}
                aria-current={superadminNav.isActive(pathname) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  superadminNav.isActive(pathname)
                    ? "bg-emerald-600/15 font-medium text-emerald-900 dark:text-emerald-200"
                    : "text-black/70 hover:bg-black/[0.04] dark:text-white/65 dark:hover:bg-white/[0.06]"
                }`}
              >
                {superadminNav.label}
              </Link>
            ) : null}
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
              onClick={() => void logout()}
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
                onClick={() => void logout()}
                className="text-xs text-emerald-700 dark:text-emerald-400"
              >
                Sair
              </button>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
              {navItems.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
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
              {isSuperadmin ? (
                <Link
                  href={superadminNav.href}
                  aria-current={superadminNav.isActive(pathname) ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                    superadminNav.isActive(pathname)
                      ? "bg-emerald-600/15 font-medium text-emerald-900 dark:text-emerald-200"
                      : "bg-black/[0.04] text-black/70 dark:bg-white/[0.06] dark:text-white/65"
                  }`}
                >
                  {superadminNav.label}
                </Link>
              ) : null}
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
