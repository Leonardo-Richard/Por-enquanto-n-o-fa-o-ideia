"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-client";

type ArtifactRow = {
  id: string;
  kind: string;
  issuedAt: string | null;
  accessKeyMasked: string;
};

type Props = {
  organizationId: string;
  companyId: string;
  refreshSignal?: number;
};

function kindLabel(kind: string): string {
  const k = kind.toLowerCase();
  if (k === "xml") return "XML";
  if (k === "pdf") return "PDF";
  return kind;
}

/** Lista integrada no painel ADN: links que abrem o download no navegador (signed URL). */
export function AdnPortalDownloadLinks({ organizationId, companyId, refreshSignal = 0 }: Props) {
  const [items, setItems] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        apiUrl(
          `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/artifacts?limit=20`,
        ),
        { credentials: "include", cache: "no-store" },
      );
      if (!r.ok) {
        setError("Não foi possível listar os ficheiros no portal.");
        setItems([]);
        return;
      }
      const j = (await r.json()) as { items?: ArtifactRow[] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setError("Erro de rede ao listar ficheiros.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, companyId]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  const downloadOne = useCallback(
    async (artifactId: string) => {
      setBusyId(artifactId);
      setError(null);
      try {
        const r = await fetch(
          apiUrl(
            `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/artifacts/${artifactId}/download`,
          ),
          { credentials: "include", cache: "no-store" },
        );
        const j = (await r.json().catch(() => null)) as { downloadUrl?: string; message?: string } | null;
        if (!r.ok) {
          setError(j?.message ?? "Não foi possível obter o link de download.");
          return;
        }
        const url = j?.downloadUrl;
        if (!url) {
          setError("Resposta sem URL de download.");
          return;
        }
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        setError("Erro de rede ao pedir o download.");
      } finally {
        setBusyId(null);
      }
    },
    [organizationId, companyId],
  );

  return (
    <div className="mt-3 border-t border-black/8 pt-3 dark:border-white/10">
      <p className="text-xs font-medium text-black/70 dark:text-white/65">Ficheiros no portal</p>
      <p className="mt-1 text-[11px] leading-relaxed text-black/50 dark:text-white/45">
        Manual ou coleta mensal: quando o job concluir, os XML/PDF ficam aqui — use «Descarregar» para o
        navegador (pasta de Downloads). O worker não grava na pasta raiz do PC excepto se o operador activar{" "}
        <code className="rounded bg-black/10 px-0.5 font-mono text-[10px] dark:bg-white/10">
          NFSE_LOCAL_MIRROR_ENABLED=1
        </code>{" "}
        no processo de recolha.
      </p>
      {loading ? (
        <p className="mt-2 text-[11px] text-black/45 dark:text-white/40">A carregar…</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[11px] text-red-800 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="mt-2 text-[11px] text-black/45 dark:text-white/40" role="status">
          Ainda sem XML/PDF nesta empresa. Enfileire uma busca e aguarde o job concluir.
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto" aria-label="Ficheiros para download">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-black/6 bg-black/[0.02] px-2 py-1.5 dark:border-white/8 dark:bg-white/[0.02]"
            >
              <div className="min-w-0 text-[11px] text-black/70 dark:text-white/65">
                <span className="font-medium">{kindLabel(row.kind)}</span>
                <span className="ml-1.5 font-mono text-[10px] text-black/55 dark:text-white/50">
                  {row.accessKeyMasked}
                </span>
                {row.issuedAt ? (
                  <span className="mt-0.5 block text-[10px] text-black/45 dark:text-white/40">
                    {new Date(row.issuedAt).toLocaleString("pt-BR")}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === row.id}
                aria-busy={busyId === row.id}
                className="shrink-0 rounded border border-black/12 px-2 py-1 text-[11px] font-medium dark:border-white/18 disabled:opacity-50"
                onClick={() => void downloadOne(row.id)}
              >
                {busyId === row.id ? "…" : "Descarregar"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length > 0 ? (
        <button
          type="button"
          className="mt-2 text-[11px] font-medium text-black/55 underline decoration-black/25 underline-offset-2 dark:text-white/50 dark:decoration-white/25"
          onClick={() => void load()}
        >
          Actualizar lista
        </button>
      ) : null}
    </div>
  );
}
