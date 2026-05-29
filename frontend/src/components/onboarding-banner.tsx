"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "portal-nf.onboarding-banner.dismissed";

export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const show = sessionStorage.getItem("portal-nf.show-onboarding") === "1";
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    setVisible(show && !dismissed);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    sessionStorage.removeItem("portal-nf.show-onboarding");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-emerald-600/25 bg-emerald-600/[0.08] p-5 dark:bg-emerald-600/[0.1]"
      role="status"
      aria-labelledby="onboarding-banner-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="onboarding-banner-title" className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            Configure a automação
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-950/85 dark:text-emerald-50/85">
            Escolha a organização, cadastre empresas monitoradas, active a sincronização ADN em{" "}
            <Link href="/configuracoes" className="font-medium underline-offset-2 hover:underline">
              Configurações
            </Link>{" "}
            e instale o worker no Windows. Consulte a página{" "}
            <Link href="/agente" className="font-medium underline-offset-2 hover:underline">
              Agente
            </Link>{" "}
            para o estado da ligação e instruções.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/empresas/nova"
              className="inline-flex rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-emerald-600"
            >
              Cadastrar empresa
            </Link>
            <Link
              href="/agente"
              className="inline-flex rounded-lg border border-emerald-800/30 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-400/40 dark:text-emerald-100"
            >
              Ver agente
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-emerald-900/70 hover:underline dark:text-emerald-100/70"
          aria-label="Fechar banner de onboarding"
        >
          Fechar
        </button>
      </div>
    </section>
  );
}
