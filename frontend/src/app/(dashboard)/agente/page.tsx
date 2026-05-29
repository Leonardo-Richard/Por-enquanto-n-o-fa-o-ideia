"use client";

import Link from "next/link";
import { useMeSummary } from "@/hooks/use-effective-organization-id";
import { AgenteReadinessChecklist } from "@/components/agente-readiness-checklist";
import { getAdnCertRunbookUrl } from "@/lib/adn-cert-runbook-url";
import { runbookAnchorProps } from "@/lib/adn-runbook-anchor";

export default function AgentePage() {
  const { effectiveOrganizationId, activeOrganizationName } = useMeSummary();
  const runbookUrl = getAdnCertRunbookUrl();
  const runbookAnchor = runbookUrl ? runbookAnchorProps(runbookUrl) : {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agente e worker</h1>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          O portal enfileira jobs ADN; a recolha no Ambiente Nacional e a cópia opcional para disco
          correm num processo Windows fora do browser.
        </p>
      </div>

      <section className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-sm font-semibold">Estado da ligação</h2>
        {effectiveOrganizationId ? (
          <p className="mt-2 text-sm text-black/70 dark:text-white/65">
            Organização activa:{" "}
            <strong className="font-medium">
              {activeOrganizationName ?? effectiveOrganizationId}
            </strong>
            . O portal não detecta automaticamente se o worker está instalado — confirme na máquina
            onde corre <code className="font-mono text-xs">poll_jobs.py</code>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200" role="status">
            Seleccione uma organização em{" "}
            <Link href="/empresas" className="font-medium underline-offset-2 hover:underline">
              Empresas
            </Link>{" "}
            para associar jobs e certificados.
          </p>
        )}
        <p className="mt-3 text-xs text-black/55 dark:text-white/50">
          Enquanto não houver worker activo com o mesmo Postgres e segredo HMAC, os jobs ficam em
          «queued» na página de execuções.
        </p>
      </section>

      <AgenteReadinessChecklist />

      <section className="rounded-xl border border-black/5 p-6 dark:border-white/10">
        <h2 className="text-sm font-semibold">Instalação (resumo)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-black/75 dark:text-white/70">
          <li>
            Active a sincronização ADN e defina a pasta raiz no servidor em{" "}
            <Link href="/configuracoes" className="text-emerald-700 dark:text-emerald-400">
              Configurações
            </Link>
            .
          </li>
          <li>
            Na ficha de cada empresa, registe o certificado digital e peça uma sincronização de
            teste.
          </li>
          <li>
            Na raiz do repositório, execute{" "}
            <code className="rounded bg-black/10 px-1 font-mono text-xs dark:bg-white/10">
              npm run dev:with-adn-bridge
            </code>{" "}
            (desenvolvimento) ou{" "}
            <code className="rounded bg-black/10 px-1 font-mono text-xs dark:bg-white/10">
              npm run worker:adn-bridge
            </code>{" "}
            com o portal já a correr.
          </li>
          <li>
            Garanta que <code className="font-mono text-xs">DATABASE_URL</code> e{" "}
            <code className="font-mono text-xs">ADN_WORKER_HMAC_SECRET</code> coincidem com o
            servidor do portal.
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-dashed border-black/10 p-6 dark:border-white/15">
        <h2 className="text-sm font-semibold">Documentação técnica</h2>
        <p className="mt-2 text-sm text-black/65 dark:text-white/60">
          Runbook de certificado e operação do worker para equipas de TI.
        </p>
        {runbookUrl ? (
          <a
            href={runbookUrl}
            {...runbookAnchor}
            className="mt-3 inline-block text-sm font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            Abrir runbook
          </a>
        ) : (
          <p className="mt-3 text-xs text-black/50 dark:text-white/45">
            URL do runbook ainda não configurada no ambiente.
          </p>
        )}
      </section>

      <p className="text-xs text-black/50 dark:text-white/45">
        O agente desktop com pairing (instalação guiada no PC do cliente) está previsto numa fase
        posterior; hoje a integração é via worker Python documentado no repositório.
      </p>
    </div>
  );
}
