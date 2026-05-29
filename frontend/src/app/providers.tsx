"use client";

import { AppSessionProvider } from "@/context/app-session";
import { ConfirmDialogProvider } from "@/context/confirm-dialog";
import { MeProvider } from "@/context/me-provider";
import { PortalProvider } from "@/context/portal-provider";
import { UiToastProvider } from "@/context/ui-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <MeProvider>
        <PortalProvider>
          <ConfirmDialogProvider>
            <UiToastProvider>{children}</UiToastProvider>
          </ConfirmDialogProvider>
        </PortalProvider>
      </MeProvider>
    </AppSessionProvider>
  );
}
