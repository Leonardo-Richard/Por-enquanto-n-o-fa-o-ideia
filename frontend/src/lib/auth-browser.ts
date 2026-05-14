/** Chamadas ao Better Auth a partir do browser (sem depender da API do pacote React). */

import { messageFromApiJson } from "./api-error-message";

export async function signInEmail(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, message: messageFromApiJson(body) ?? "Credenciais inválidas." };
  }
  return { ok: true };
}

export async function signUpEmail(input: {
  name: string;
  email: string;
  password: string;
  legalDocumentVersion: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, message: messageFromApiJson(body) ?? "Não foi possível criar a conta." };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
  });
}

export async function forgetPassword(email: string, redirectTo: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/auth/request-password-reset", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirectTo }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, message: messageFromApiJson(body) ?? "Pedido inválido." };
  }
  return { ok: true };
}
