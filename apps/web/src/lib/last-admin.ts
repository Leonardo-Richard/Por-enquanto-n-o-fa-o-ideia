/** Regra de negócio: a empresa não pode ficar sem pelo menos um administrador. */
export function wouldViolateLastAdmin(
  adminCount: number,
  targetIsAdmin: boolean,
  action: "demote" | "remove",
): boolean {
  if (!targetIsAdmin) {
    return false;
  }
  if (adminCount <= 1) {
    return action === "demote" || action === "remove";
  }
  return false;
}
