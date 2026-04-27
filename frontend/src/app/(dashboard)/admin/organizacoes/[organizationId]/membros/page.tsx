import { OrganizationMembersPage } from "@/components/admin/organization-members-page";

export default async function OrganizationMembrosPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationMembersPage organizationId={organizationId} />;
}
