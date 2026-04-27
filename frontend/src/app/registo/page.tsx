"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signUpEmail } from "@/lib/auth-browser";

export default function RegistoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const r = await signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.replace("/empresas");
    } catch {
      setError("Erro ao registar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-2 text-center text-sm text-black/60 dark:text-white/55">
          Mínimo 8 caracteres na senha. O e-mail deve ser único.
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
            <label htmlFor="name" className="text-xs font-medium text-black/70 dark:text-white/65">
              Nome
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-xs font-medium text-black/70 dark:text-white/65">
              E-mail
            </label>
            <input
              id="email"
              type="email"
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
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-medium text-[var(--background)] disabled:opacity-50"
          >
            {busy ? "A criar…" : "Registar"}
          </button>
        </form>
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
            Já tenho conta
          </Link>
        </p>
      </div>
    </div>
  );
}
