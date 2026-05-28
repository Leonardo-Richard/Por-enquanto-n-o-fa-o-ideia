/** Utilizador técnico para auditoria de jobs ADN sem `requested_by_user_id` (cron/mensal). */
export const ADN_SYSTEM_AUDIT_USER_ID = "system:adn-scheduler";

export function resolveAdnAuditActorId(requestedByUserId: string | null | undefined): string | null {
  if (requestedByUserId?.trim()) return requestedByUserId.trim();
  const fromEnv = process.env["ADN_SYSTEM_AUDIT_USER_ID"]?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : ADN_SYSTEM_AUDIT_USER_ID;
}
