import { enforceAdminPortalGate } from "@/server/admin/admin-portal-gate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await enforceAdminPortalGate();
  return children;
}
