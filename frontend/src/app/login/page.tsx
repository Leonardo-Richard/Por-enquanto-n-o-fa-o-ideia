"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/context/app-session";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { signInEmail } from "@/lib/auth-browser";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

async function tryAutoSelectSingleOrganization() {
  const res = await fetch("/api/v1/organizations/accessible?page=1&pageSize=5", {
    credentials: "include",
  });
  if (!res.ok) {
    return;
  }
  const body = (await res.json()) as { items: { id: string }[] };
  if (body.items?.length !== 1 || !body.items[0]) {
    return;
  }
  const only = body.items[0].id;
  await fetch("/api/v1/session/active-organization", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: only }),
  });
}

function LoginForm() {
  const { data, isPending, refetch } = useAppSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && data?.user) {
      void (async () => {
        await tryAutoSelectSingleOrganization();
        router.replace(nextPath);
      })();
    }
  }, [isPending, data?.user, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await signInEmail(email.trim(), password);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      await refetch();
      await tryAutoSelectSingleOrganization();
      await refetch();
      router.replace(nextPath);
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-black/60 dark:text-white/55">
        Carregando…
      </div>
    );
  }

  if (data?.user) {
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
          Utilize a sua conta (sessão segura em cookie HttpOnly).
        </p>

        <form
          onSubmit={(ev) => void onSubmit(ev)}
          className="mt-10 space-y-4 rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]"
        >
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
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
            disabled={busy}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "A entrar…" : "Continuar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-black/60 dark:text-white/55">
          <Link href="/registo" className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
            Criar conta
          </Link>
          {" · "}
          <Link href="/recuperar" className="underline-offset-2 hover:underline">
            Esqueci a senha
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-black/50 dark:text-white/45">
          <LegalFooterLinks className="inline-flex flex-wrap justify-center gap-x-2 gap-y-1" />
        </p>
        <p className="mt-4 text-center text-xs text-black/50 dark:text-white/45">
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
