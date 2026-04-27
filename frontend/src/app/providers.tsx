"use client";

import { AppSessionProvider } from "@/context/app-session";
import { PortalProvider } from "@/context/portal-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <PortalProvider>{children}</PortalProvider>
    </AppSessionProvider>
  );
}
