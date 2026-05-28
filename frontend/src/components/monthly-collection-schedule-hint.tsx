"use client";

import type { MonthlyCollectionPreview } from "@repo/shared";
import {
  civilDaysUntilSp,
  formatScheduledAtPtBr,
  relativeDaysLabel,
} from "@/lib/monthly-collection-schedule";

export type MonthlyCollectionScheduleHintProps = {
  monthlyRunDay: number;
  preview: MonthlyCollectionPreview | null | undefined;
  loading?: boolean;
  /** Pré-visualização antes de guardar alterações ao dia D. */
  isDraftPreview?: boolean;
};

export function MonthlyCollectionScheduleHint({
  monthlyRunDay,
  preview,
  loading = false,
  isDraftPreview = false,
}: MonthlyCollectionScheduleHintProps) {
  if (loading) {
    return (
      <p className="mt-4 max-w-xl text-sm text-black/55 dark:text-white/50">
        A calcular próxima coleta automática…
      </p>
    );
  }

  if (!preview) {
    return (
      <p className="mt-4 max-w-xl text-sm text-black/70 dark:text-white/65">
        Coleta automática mensal: dia <strong>{monthlyRunDay}</strong>, às 06:00
        (América/São Paulo).
      </p>
    );
  }

  if (!preview.adnSyncEnabled) {
    return (
      <div className="mt-4 max-w-xl space-y-1 text-sm text-black/70 dark:text-white/65">
        <p>
          <strong>Coleta automática:</strong> desactivada — a sincronização ADN não
          está activa nesta organização. Active ADN nas configurações para
          agendar no dia <strong>{monthlyRunDay}</strong> de cada mês.
        </p>
      </div>
    );
  }

  if (!preview.scheduledAt) {
    return null;
  }

  const formatted = formatScheduledAtPtBr(preview.scheduledAt);
  const days = civilDaysUntilSp(preview.scheduledAt);
  const relative = relativeDaysLabel(days, preview.isToday);

  return (
    <div className="mt-4 max-w-xl space-y-1.5 text-sm text-black/70 dark:text-white/65">
      <p>
        <strong>Próxima coleta automática:</strong>{" "}
        {preview.isToday ? (
          <>
            hoje, <span className="whitespace-nowrap">{formatted}</span>
          </>
        ) : (
          <span className="whitespace-nowrap">{formatted}</span>
        )}
        {relative && !preview.isToday ? (
          <>
            {" "}
            — <span className="text-black/55 dark:text-white/50">{relative}</span>
          </>
        ) : null}
        .
      </p>
      <p className="text-xs text-black/55 dark:text-white/50">
        O sistema enfileira o pedido por volta das 06:05 (horário de São Paulo);
        o worker na sua máquina executa quando estiver ligado. Dia configurado:{" "}
        <strong>{monthlyRunDay}</strong>.
        {preview.alreadyEnqueuedThisMonth ? (
          <>
            {" "}
            Já existe coleta automática agendada ou concluída neste mês — a
            seguinte será no próximo mês civil.
          </>
        ) : null}
      </p>
      {isDraftPreview ? (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200/90">
          Pré-visualização — guarde as alterações para confirmar o dia da coleta.
        </p>
      ) : null}
    </div>
  );
}
