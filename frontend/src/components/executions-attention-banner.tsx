"use client";

import Link from "next/link";
import type { AdnExecutionsOverviewAttention } from "@repo/shared";

export type ExecutionsAttentionBannerProps = {
  attention: AdnExecutionsOverviewAttention;
};

export function ExecutionsAttentionBanner({ attention }: ExecutionsAttentionBannerProps) {
  const { failedLast7d, staleQueued } = attention;
  if (failedLast7d <= 0 && staleQueued <= 0) {
    return null;
  }

  return (
    <div
      className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50"
      role="status"
    >
      {failedLast7d > 0 ? (
        <p>
          <strong className="font-medium">{failedLast7d}</strong>{" "}
          {failedLast7d === 1 ? "falha" : "falhas"} nos últimos 7 dias.{" "}
          <Link
            href="/execucoes?status=failed"
            className="font-medium underline underline-offset-2"
          >
            Ver execuções com falha
          </Link>
        </p>
      ) : null}
      {staleQueued > 0 ? (
        <p>
          <strong className="font-medium">{staleQueued}</strong>{" "}
          {staleQueued === 1 ? "coleta aguarda" : "coletas aguardam"} o worker de recolha (na fila há
          algum tempo). Isto é normal quando o worker está offline — não é culpa sua.{" "}
          <Link
            href="/configuracoes"
            className="font-medium underline underline-offset-2"
          >
            Configurações e runbook
          </Link>
        </p>
      ) : null}
    </div>
  );
}
