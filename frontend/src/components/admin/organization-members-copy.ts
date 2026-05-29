/** Copy PT-BR (spec UX §10 — chaves `mem.catalog.*` para rastreio i18n). */
export const organizationMembersCopy = {
  backToOrganizations: "Voltar às organizações",
  listTitle: "Membros",
  listSubtitle: (name: string) => `Organização: ${name}`,
  searchLabel: "Filtrar por nome ou e-mail",
  searchPlaceholder: "Filtra à medida que escreve…",
  emptySystem: "Ainda não há utilizadores no sistema.",
  emptyFilter: "Nenhum utilizador corresponde ao filtro.",
  paginationStatus: (pageNum: number, visibleTotal: number) =>
    `Página ${pageNum} · ${visibleTotal} utilizador(es) visíveis`,
  truncationWarning: (maxLoaded: number) =>
    `Lista truncada: foram carregados no máximo ${maxLoaded} utilizadores. Refine operações ou contacte suporte.`,
  catalogRefetchRetry: "Tentar novamente",
  liveRegionResults: (count: number) => `${count} resultados`,
  tableSuperadmin: "Superadmin",
  tableInOrg: "Nesta organização",
  inOrgYes: "Membro",
  inOrgNo: "—",
  rowAddToOrg: "Adicionar à organização",
  ctaAddExisting: "Adicionar membro existente",
  ctaCreateUser: "Criar utilizador e adicionar",
  roleAdmin: "Administrador da organização",
  roleUser: "Utilizador da organização",
  tableUser: "Utilizador",
  tableRole: "Papel",
  tableJob: "Cargo",
  tableDept: "Departamento",
  tablePhone: "Contato",
  tableActions: "Acções",
  rowEdit: "Editar",
  rowRemove: "Remover vínculo",
  superadminYes: "Sim",
  superadminNo: "Não",
  addExistingTitle: "Adicionar membro existente",
  addExistingSubmit: "Adicionar à organização",
  createUserTitle: "Criar utilizador e adicionar",
  createUserSubmit: "Criar e associar",
  editTitle: "Editar membro",
  editSubmit: "Guardar alterações",
  removeTitle: "Remover vínculo com esta organização?",
  removeBody:
    "O utilizador deixa de ter acesso a esta organização. A conta global não é eliminada.",
  removeCta: "Remover vínculo",
  errorLastAdmin:
    "É necessário pelo menos um administrador da organização. Promova outro membro a administrador antes de continuar.",
  errorDuplicate: "Este utilizador já é membro desta organização.",
  errorGeneric: "Não foi possível concluir a operação. Tente novamente.",
  searching: "A procurar…",
} as const;

export function mapOrganizationMemberApiCodeToMessage(code: string | undefined): string | undefined {
  if (code === "LAST_ORG_ADMIN") return organizationMembersCopy.errorLastAdmin;
  if (code === "MEMBERSHIP_DUPLICATE") return organizationMembersCopy.errorDuplicate;
  if (code === "USER_EMAIL_CONFLICT") return "Já existe uma conta com este e-mail.";
  return undefined;
}

export const MEMBERS_SERVER_SEARCH_ENABLED =
  process.env.NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_MEMBERS_SERVER_SEARCH_ENABLED === "true";
