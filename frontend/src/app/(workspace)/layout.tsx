import { Suspense, type ReactNode } from "react";
import { ProtectedShell } from "@/components/protected-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="session-check"><span className="loading-mark" /></main>}>
      <ProtectedShell>{children}</ProtectedShell>
    </Suspense>
  );
}