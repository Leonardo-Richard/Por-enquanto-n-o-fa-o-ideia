import Link from "next/link";

export type LocalDownloadRootCalloutVariant = "missing" | "configured";

export type LocalDownloadRootCalloutProps = {
  variant: LocalDownloadRootCalloutVariant;
  settingsHref?: string;
  /** Opcional; na ficha usamos sobretudo o estado «configurada» sem path completo (FR66). */
  pathPreview?: string;
};

const DEFAULT_SETTINGS_HREF = "/configuracoes";

/**
 * Callout persistente para pasta raiz de download da organização (FR65 / FR66).
 * `role="status"` — aviso informativo, não crítico (spec UX §8).
 */
export function LocalDownloadRootCallout({
  variant,
  settingsHref = DEFAULT_SETTINGS_HREF,
  pathPreview,
}: LocalDownloadRootCalloutProps) {
  if (variant === "missing") {
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100"
      >
        <p>
          A pasta raiz de download da organização não está definida. As notas podem ficar só no
          portal até configurar a pasta em{" "}
          <Link
            href={settingsHref}
            className="font-medium text-amber-900 underline decoration-amber-900/40 underline-offset-2 dark:text-amber-200 dark:decoration-amber-200/40"
          >
            Configurações
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100"
    >
      <p>
        Pasta raiz configurada para espelho local no servidor de recolha.
        {pathPreview ? (
          <>
            {" "}
            <span className="font-mono text-[0.7rem] opacity-90">{pathPreview}</span>
          </>
        ) : null}{" "}
        <Link
          href={settingsHref}
          className="font-medium text-emerald-900 underline decoration-emerald-900/40 underline-offset-2 dark:text-emerald-200 dark:decoration-emerald-200/40"
        >
          Alterar em Configurações
        </Link>
        .
      </p>
    </div>
  );
}
