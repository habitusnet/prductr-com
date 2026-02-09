"use client";

import { EventProvider } from "@/components/EventProvider";
import { AuthProvider } from "./auth-provider";
import type { ReactNode } from "react";

export function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <EventProvider>{children}</EventProvider>
    </AuthProvider>
  );
}
