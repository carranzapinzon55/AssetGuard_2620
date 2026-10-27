"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { clearSession, readSession, saveSession, type AuthSession } from "@/lib/auth";

type AuthSnapshot = { session: AuthSession | null; ready: boolean };

type AuthContextValue = {
  session: AuthSession | null;
  ready: boolean;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const serverSnapshot: AuthSnapshot = { session: null, ready: false };
let clientSnapshot: AuthSnapshot | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): AuthSnapshot {
  if (clientSnapshot === undefined) {
    clientSnapshot = { session: readSession(), ready: true };
  }
  return clientSnapshot;
}

function getServerSnapshot(): AuthSnapshot {
  return serverSnapshot;
}

function notifyStorageChange() {
  clientSnapshot = { session: readSession(), ready: true };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", notifyStorageChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", notifyStorageChange);
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function signIn(nextSession: AuthSession) {
    saveSession(nextSession);
    clientSnapshot = { session: nextSession, ready: true };
    listeners.forEach((listener) => listener());
  }

  function signOut() {
    clearSession();
    clientSnapshot = { session: null, ready: true };
    listeners.forEach((listener) => listener());
  }

  return (
    <AuthContext.Provider value={{ session, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}