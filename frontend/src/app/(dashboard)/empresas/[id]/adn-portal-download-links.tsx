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
  const [hasPdfs, setHasPdfs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyZip, setBusyZip] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/artifacts`;
      const [listRes, pdfProbeRes] = await Promise.all([
        fetch(apiUrl(`${base}?limit=20`), { credentials: "include", cache: "no-store" }),
        fetch(apiUrl(`${base}?kind=pdf&limit=1`), { credentials: "include", cache: "no-store" }),
      ]);
      if (!listRes.ok) {
        setError("Não foi possível listar os ficheiros no portal.");
        setItems([]);
        setHasPdfs(false);
        return;
      }
      const j = (await listRes.json()) as { items?: ArtifactRow[] };
      setItems(Array.isArray(j.items) ? j.items : []);
      if (pdfProbeRes.ok) {
        const pj = (await pdfProbeRes.json()) as { items?: ArtifactRow[] };
        setHasPdfs(Array.isArray(pj.items) && pj.items.length > 0);
      } else {
        setHasPdfs(false);
      }
    } catch {
      setError("Erro de rede ao listar ficheiros.");
      setItems([]);
      setHasPdfs(false);
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

  const downloadAllPdfsZip = useCallback(async () => {
    setBusyZip(true);
    setError(null);
    try {
      const r = await fetch(
        apiUrl(
          `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/artifacts/pdfs.zip`,
        ),
        { credentials: "include", cache: "no-store" },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { message?: string } | null;
        setError(j?.message ?? "Não foi possível gerar o ZIP de PDFs.");
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition");
      let filename = "pdfs.zip";
      const match = cd?.match(/filename="([^"]+)"/);
      if (match?.[1]) {
        filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro de rede ao pedir o ZIP de PDFs.");
    } finally {
      setBusyZip(false);
    }
  }, [organizationId, companyId]);

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
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {hasPdfs ? (
          <button
            type="button"
            disabled={busyZip || Boolean(busyId)}
            aria-busy={busyZip}
            className="rounded border border-black/12 px-2.5 py-1 text-[11px] font-medium dark:border-white/18 disabled:opacity-50"
            onClick={() => void downloadAllPdfsZip()}
          >
            {busyZip ? "A gerar ZIP…" : "Descarregar todos os PDFs (ZIP)"}
          </button>
        ) : null}
        {hasPdfs ? (
          <p className="text-[10px] text-black/45 dark:text-white/40">
            Inclui todos os PDFs no portal (até 200 por pedido).
          </p>
        ) : null}
        {items.length > 0 || hasPdfs ? (
          <button
            type="button"
            className="text-[11px] font-medium text-black/55 underline decoration-black/25 underline-offset-2 dark:text-white/50 dark:decoration-white/25"
            onClick={() => void load()}
          >
            Actualizar lista
          </button>
        ) : null}
      </div>
    </div>
  );
}
