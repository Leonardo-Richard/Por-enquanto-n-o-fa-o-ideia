/**
 * Versão dos documentos legais (privacidade + termos) em vigor.
 * Ao alterar o texto em `/privacidade` ou `/termos`, incremente esta constante
 * e actualize a cópia dos documentos para manter correspondência auditável.
 */
export const LEGAL_DOCUMENT_VERSION = "2026-05-13-v1" as const;

/** Conta criada por administrador da organização (convite / criação interna). */
export const ORG_ADMIN_PROVISIONED_VERSION = "org-admin-provisioned-v1" as const;

/** Utilizadores criados apenas em testes de integração (não usar em produção). */
export const INTEGRATION_TEST_LEGAL_VERSION = "integration-test-v1" as const;

export const ALLOWED_LEGAL_DOCUMENT_VERSIONS = [
  LEGAL_DOCUMENT_VERSION,
  ORG_ADMIN_PROVISIONED_VERSION,
  INTEGRATION_TEST_LEGAL_VERSION,
] as const;

export type LegalDocumentVersion = (typeof ALLOWED_LEGAL_DOCUMENT_VERSIONS)[number];

export function publicLgpdContactLine(): string {
  const email = process.env.NEXT_PUBLIC_LGPD_CONTACT_EMAIL?.trim();
  if (email) {
    return `Para pedidos relacionados com dados pessoais, contacte: ${email}`;
  }
  return "Para pedidos relacionados com dados pessoais (acesso, correção, eliminação, portabilidade, revogação de consentimento ou informações), utilize o canal de suporte indicado pelo operador do serviço que lhe forneceu acesso.";
}
