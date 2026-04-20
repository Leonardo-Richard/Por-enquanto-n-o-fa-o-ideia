/** Tipos e constantes partilhados entre apps (ver docs/architecture.md — packages/shared). */
export const APP_SLUG = "portal-automacao-nf" as const;

export type HealthStatus = {
  status: "ok" | "degraded";
};
