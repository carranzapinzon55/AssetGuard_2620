"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { formatCurrency } from "@/lib/utils";

export type Currency = "USD" | "COP";

export const COP_PER_USD = 4000;

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatMoney: (usdAmount: number) => string;
  convertToUsd: (amount: number, currency: Currency) => number;
  convertFromUsd: (usdAmount: number, currency: Currency) => number;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const currencyListeners = new Set<() => void>();

function getCurrencySnapshot(): Currency {
  if (typeof window === "undefined") return "USD";
  const savedCurrency = localStorage.getItem("assetguard-currency");
  return savedCurrency === "COP" ? "COP" : "USD";
}

function getServerCurrencySnapshot(): Currency {
  return "USD";
}

function subscribeToCurrency(listener: () => void) {
  currencyListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    currencyListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useSyncExternalStore(
    subscribeToCurrency,
    getCurrencySnapshot,
    getServerCurrencySnapshot,
  );

  function setCurrency(nextCurrency: Currency) {
    localStorage.setItem("assetguard-currency", nextCurrency);
    currencyListeners.forEach((listener) => listener());
  }

  function convertFromUsd(usdAmount: number, targetCurrency: Currency) {
    return targetCurrency === "COP" ? usdAmount * COP_PER_USD : usdAmount;
  }

  function convertToUsd(amount: number, sourceCurrency: Currency) {
    return sourceCurrency === "COP" ? amount / COP_PER_USD : amount;
  }

  function formatMoney(usdAmount: number) {
    return formatCurrency(convertFromUsd(usdAmount, currency), currency);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatMoney, convertToUsd, convertFromUsd }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency debe usarse dentro de CurrencyProvider");
  return value;
}