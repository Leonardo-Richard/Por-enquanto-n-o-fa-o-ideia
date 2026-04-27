/**
 * NFR29 / EM-01B AC9: só disparar GET/POST ADN quando a linha pertence à org activa da página.
 */
export function shouldOfferAdnSyncForRow(
  effectiveOrganizationId: string | null | undefined,
  companyOrganizationId: string,
): boolean {
  return effectiveOrganizationId != null && companyOrganizationId === effectiveOrganizationId;
}
