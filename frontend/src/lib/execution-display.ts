/**
 * Rótulos partilhados para histórico de execuções (dashboard + lista).
 * Copy v1: origem mensal neutra (sem “dia 1º” fixo) — FR-ADN-MONTHLY-07.
 */
export function executionTriggerLabel(trigger: string): string {
  if (trigger === "signup") {
    return "Pós-cadastro";
  }
  if (trigger === "monthly") {
    return "Agendada (mensal)";
  }
  return "Manual";
}

export function executionStatusLabel(status: string): string {
  if (status === "running") {
    return "Em execução";
  }
  if (status === "failed") {
    return "Falhou";
  }
  return "Concluída";
}
