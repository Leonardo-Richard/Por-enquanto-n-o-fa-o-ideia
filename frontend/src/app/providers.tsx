"use client";

import { AppSessionProvider } from "@/context/app-session";
import { MeProvider } from "@/context/me-provider";
import { PortalProvider } from "@/context/portal-provider";
import { UiToastProvider } from "@/context/ui-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <MeProvider>
        <PortalProvider>
          <UiToastProvider>{children}</UiToastProvider>
        </PortalProvider>
      </MeProvider>
    </AppSessionProvider>
  );
}
