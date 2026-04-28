"use client";

import { AppSessionProvider } from "@/context/app-session";
import { PortalProvider } from "@/context/portal-provider";
import { UiToastProvider } from "@/context/ui-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <PortalProvider>
        <UiToastProvider>{children}</UiToastProvider>
      </PortalProvider>
    </AppSessionProvider>
  );
}
