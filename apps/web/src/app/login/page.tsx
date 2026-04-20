"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { usePortal } from "@/context/portal-provider";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function LoginForm() {
  const { hydrated, user, login } = usePortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (hydrated && user) {
      router.replace(nextPath);
    }
  }, [hydrated, user, router, nextPath]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login(email, password);
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-black/60 dark:text-white/55">
        Carregando…
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-center text-sm font-semibold tracking-tight">
          Portal de Automação de NF
        </p>
        <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight">
          Entrar
        </h1>
        <p className="mt-2 text-center text-sm text-black/60 dark:text-white/55">
          Demonstração local: qualquer e-mail e senha preenchem o acesso. Os
          dados ficam neste navegador.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-4 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div>
            <label htmlFor="email" className="text-xs font-medium text-black/70 dark:text-white/65">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-black/70 dark:text-white/65">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            />
          </div>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
          >
            Continuar
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-black/50 dark:text-white/45">
          <Link href="/" className="underline-offset-2 hover:underline">
            Voltar ao site público
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-black/60 dark:text-white/55">
          Carregando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
