import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { CurrencyProvider } from "@/components/currency-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetGuard | GlobalNet",
  description: "Control de activos y custodias de GlobalNet.",
  icons: { icon: "/AssetGuard_2620_isotipo_app.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <CurrencyProvider>
          <AuthProvider>{children}</AuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
