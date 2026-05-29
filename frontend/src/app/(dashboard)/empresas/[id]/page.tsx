"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import {
  formatCnpj,
  messageFromMonthlyRunDayParse,
  type Company,
  type MonthlyCollectionPreview,
} from "@repo/shared";
import { MonthlyCollectionScheduleHint } from "@/components/monthly-collection-schedule-hint";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { buildMonthlyCollectionPreview } from "@/lib/monthly-collection-schedule";
import { mirrorDestinationPathPreview } from "@/lib/mirror-destination-preview";
import { useAppSession } from "@/context/app-session";
import { useConfirmDialog } from "@/context/confirm-dialog";
import { useOrganizationAdnSyncSettings } from "@/hooks/use-organization-adn-sync-settings";
import { apiFetch } from "@/lib/api-client";
import { AdnSyncPanel } from "./adn-sync-panel";

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function EmpresaDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { refetch } = useAppSession();
  const { confirm } = useConfirmDialog();
  const router = useRouter();
  const monthlyHelpId = useId();
  const monthlyRunDayErrorId = useId();

  const [company, setCompany] = useState<Company | null>(null);
  const [monthlyCollection, setMonthlyCollection] = useState<
    MonthlyCollectionPreview | null | undefined
  >(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tradeName, setTradeName] = useState("");
  const [systemCode, setSystemCode] = useState("");
  const [monthlyRunDay, setMonthlyRunDay] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      const res = await apiFetch(`/api/v1/companies/${id}`);
      if (!res.ok) {
        if (!cancelled) {
          setLoadError("Empresa não encontrada ou sem acesso.");
          setCompany(null);
          setLoading(false);
        }
        return;
      }
      const body = (await res.json()) as {
        company: Company;
        monthlyCollection?: MonthlyCollectionPreview;
      };
      if (cancelled) {
        return;
      }
      setCompany(body.company);
      setMonthlyCollection(body.monthlyCollection ?? null);
      setTradeName(body.company.tradeName);
      setSystemCode(body.company.systemCode);
      setMonthlyRunDay(body.company.monthlyRunDay);
      setDirty(false);
      setFieldError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isDraftPreview =
    company !== null && dirty && monthlyRunDay !== company.monthlyRunDay;

  const displayPreview = useMemo((): MonthlyCollectionPreview | null | undefined => {
    if (!company || monthlyCollection === undefined) {
      return undefined;
    }
    if (!monthlyCollection || !isDraftPreview) {
      return monthlyCollection;
    }
    return buildMonthlyCollectionPreview({
      monthlyRunDay,
      adnSyncEnabled: monthlyCollection.adnSyncEnabled,
      hasMonthlyJobForCurrentPeriod: monthlyCollection.alreadyEnqueuedThisMonth,
    });
  }, [company, monthlyCollection, isDraftPreview, monthlyRunDay]);

  const effectiveMonthlyRunDay =
    company && isDraftPreview ? monthlyRunDay : (company?.monthlyRunDay ?? monthlyRunDay);

  const orgSettings = useOrganizationAdnSyncSettings({
    organizationId: company?.organizationId ?? "",
    fetchEnabled: Boolean(company?.organizationId),
  });

  if (loading && !company && !loadError) {
    return <PageLoadingSkeleton label="A carregar ficha da empresa" />;
  }

  if (loadError || !company) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black/65 dark:text-white/60">
          {loadError ?? "A carregar…"}
        </p>
        <Link
          href="/empresas"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Voltar ao picker
        </Link>
      </div>
    );
  }

  const comp = company;
  const serverPath =
    orgSettings.data?.localDownloadRoot?.trim() ?
      mirrorDestinationPathPreview(
        orgSettings.data.localDownloadRoot.trim(),
        comp.systemCode,
        comp.tradeName,
        comp.cnpjDigits,
      )
    : null;

  async function save() {
    setFieldError(null);
    const monthlyErr = messageFromMonthlyRunDayParse(monthlyRunDay);
    if (monthlyErr) {
      setFieldError(monthlyErr);
      return;
    }
    const res = await apiFetch(`/api/v1/companies/${comp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeName,
        systemCode,
        monthlyRunDay,
      }),
    });
    if (!res.ok) {
      setFieldError("Não foi possível guardar.");
      return;
    }
    const body = (await res.json()) as {
      company: Company;
      monthlyCollection?: MonthlyCollectionPreview;
    };
    setCompany(body.company);
    setMonthlyCollection(body.monthlyCollection ?? null);
    setMonthlyRunDay(body.company.monthlyRunDay);
    setDirty(false);
  }

  async function remove() {
    const ok = await confirm({
      title: "Excluir empresa?",
      description:
        "Remover esta empresa da plataforma? Os vínculos de membros serão removidos. Esta acção não pode ser desfeita pelo portal.",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) {
      return;
    }
    const res = await apiFetch(`/api/v1/companies/${comp.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      window.alert("Sem permissão ou erro ao remover.");
      return;
    }
    await refetch(true);
    router.push("/empresas");
  }

  const monthlySelectDescribedBy = fieldError
    ? `${monthlyHelpId} ${monthlyRunDayErrorId}`
    : monthlyHelpId;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/empresas"
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Empresas
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {formatCnpj(comp.cnpjDigits)}
          </h1>
          <Link
            href={`/empresas/${comp.id}/usuarios`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Membros e acesso →
          </Link>
        </div>
        <p className="mt-1 text-xs text-black/50 dark:text-white/45">
          Cadastrada em {new Date(comp.createdAt).toLocaleString("pt-BR")}
        </p>
        <MonthlyCollectionScheduleHint
          monthlyRunDay={effectiveMonthlyRunDay}
          preview={displayPreview}
          loading={monthlyCollection === undefined}
          isDraftPreview={isDraftPreview}
        />
      </div>

      <AdnSyncPanel company={comp} />

      <section className="rounded-xl border border-black/5 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-sm font-semibold">Pasta no servidor (worker)</h2>
        {orgSettings.loading ? (
          <p className="mt-2 text-xs text-black/50 dark:text-white/45">A carregar caminho…</p>
        ) : serverPath ? (
          <p className="mt-2 break-all font-mono text-xs leading-relaxed text-black/75 dark:text-white/70">
            {serverPath}
          </p>
        ) : (
          <p className="mt-2 text-xs text-black/55 dark:text-white/50">
            Defina a pasta raiz em{" "}
            <Link href="/configuracoes" className="font-medium text-emerald-700 dark:text-emerald-400">
              Configurações
            </Link>{" "}
            → Pasta raiz no disco (servidor).
          </p>
        )}
        <p className="mt-3 text-xs text-black/55 dark:text-white/50">
          Caminho efectivo usado pelo worker quando o espelho local está activo. Formato:{" "}
          <span className="font-mono">raiz\codigo-apelido</span>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Dados</h2>
        <div>
          <label
            htmlFor="tradeName"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Nome fantasia
          </label>
          <input
            id="tradeName"
            value={tradeName}
            onChange={(e) => {
              setTradeName(e.target.value);
              setDirty(true);
            }}
            className="mt-1.5 w-full max-w-md rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          />
        </div>
        <div>
          <label
            htmlFor="systemCode"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Código do sistema
          </label>
          <input
            id="systemCode"
            value={systemCode}
            onChange={(e) => {
              setSystemCode(e.target.value);
              setDirty(true);
            }}
            className="mt-1.5 w-full max-w-md rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 font-mono text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          />
        </div>
        <div>
          <label
            htmlFor="monthlyRunDay"
            className="text-xs font-medium text-black/70 dark:text-white/65"
          >
            Dia da coleta mensal
          </label>
          <select
            id="monthlyRunDay"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={monthlySelectDescribedBy}
            value={monthlyRunDay}
            onChange={(e) => {
              setMonthlyRunDay(Number(e.target.value));
              setDirty(true);
              setFieldError(null);
            }}
            className="mt-1.5 w-full max-w-xs rounded-lg border border-black/10 bg-[var(--background)] px-3 py-2 text-sm outline-none ring-emerald-600/30 focus:ring-2 dark:border-white/15"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <p
            id={monthlyHelpId}
            className="mt-1.5 text-xs text-black/50 dark:text-white/45"
          >
            A coleta recorrente corre às <strong>06:00</strong> no fuso{" "}
            <strong>América/São Paulo</strong>.
          </p>
        </div>
        {fieldError ? (
          <p
            id={monthlyRunDayErrorId}
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {fieldError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => void save()}
            className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Salvar alterações
          </button>
        </div>
      </section>

      <section className="max-w-xl rounded-lg border border-black/8 bg-black/[0.02] px-4 py-3 dark:border-white/12 dark:bg-white/[0.03]">
        <p className="text-xs leading-relaxed text-black/65 dark:text-white/60">
          A ligação real ao <strong className="font-medium text-black/80 dark:text-white/75">Ambiente Nacional</strong>{" "}
          faz-se pelo bloco <strong className="font-medium text-black/80 dark:text-white/75">Sincronização ADN</strong>{" "}
          acima: o portal enfileira um job na base de dados e um{" "}
          <strong className="font-medium text-black/80 dark:text-white/75">worker</strong> (fora do browser) deve
          processá-lo. Um administrador da organização pode activar a funcionalidade em{" "}
          <strong className="font-medium text-black/80 dark:text-white/75">Configurações</strong>. O separador{" "}
          <strong className="font-medium text-black/80 dark:text-white/75">Execuções</strong> mostra o
          histórico real dos jobs ADN na fila (estado, gatilho e detalhe).
        </p>
      </section>

      <section className="border-t border-black/5 pt-8 dark:border-white/10">
        <button
          type="button"
          onClick={() => void remove()}
          className="text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Excluir empresa…
        </button>
      </section>
    </div>
  );
}
