/** Escapa wildcards ILIKE (`%`, `_`, `\`) em fragmentos de pesquisa do utilizador. */
export function sanitizeIlikeFragment(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "");
}

/** Papel mais permissivo entre dois papéis de empresa/org. */
export function strongerRole(
  a: "user" | "admin" | null | undefined,
  b: "user" | "admin" | null | undefined,
): "user" | "admin" | null {
  const x = a ?? null;
  const y = b ?? null;
  if (x === "admin" || y === "admin") return "admin";
  if (x === "user" || y === "user") return "user";
  return null;
}
