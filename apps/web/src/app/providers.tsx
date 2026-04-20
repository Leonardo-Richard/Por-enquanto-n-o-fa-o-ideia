"use client";

import { PortalProvider } from "@/context/portal-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <PortalProvider>{children}</PortalProvider>;
}
