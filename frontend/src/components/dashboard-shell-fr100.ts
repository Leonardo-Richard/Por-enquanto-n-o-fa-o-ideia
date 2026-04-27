/**
 * FR100 / SMEM-07 AC8 — o item de navegação «Organizações» só deve aparecer para superadmin.
 * Função pura para teste unitário da regra (substituto a RTL/axe até checklist NFR35 no PR).
 */
export function isSuperadminOrganizationsNavVisible(isSuperadmin: boolean): boolean {
  return Boolean(isSuperadmin);
}
