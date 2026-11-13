export function formatCurrency(amount: number, currency: "USD" | "COP" = "USD"): string {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return currency === "COP" ? `$ ${formattedAmount} COP` : `$ ${formattedAmount}`;
}