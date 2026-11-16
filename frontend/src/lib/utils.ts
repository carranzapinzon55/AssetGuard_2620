export function formatCurrency(amount: number, currency: "USD" | "COP" = "USD"): string {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return currency === "COP" ? `$ ${formattedAmount} COP` : `$ ${formattedAmount} USD`;
}

export function formatCurrencyCop(usdAmount: number): string {
  const formattedAmount = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdAmount * 4000);

  return `$ ${formattedAmount} COP`;
}

export function matchesSearch(text: string, query: string): boolean {
  const normalize = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const normalizedText = normalize(text);
  const textWords = normalizedText.split(" ");
  const queryWords = normalizedQuery.split(" ");
  return queryWords.every((queryWord) =>
    textWords.some((word) => word.includes(queryWord) || (queryWord.length >= 4 && hasSingleEditMatch(word, queryWord))),
  );
}

function hasSingleEditMatch(word: string, query: string): boolean {
  if (Math.abs(word.length - query.length) > 1) return false;
  let wordIndex = 0;
  let queryIndex = 0;
  let edits = 0;

  while (wordIndex < word.length && queryIndex < query.length) {
    if (word[wordIndex] === query[queryIndex]) {
      wordIndex += 1;
      queryIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (word.length > query.length) wordIndex += 1;
    else if (query.length > word.length) queryIndex += 1;
    else {
      wordIndex += 1;
      queryIndex += 1;
    }
  }
  return edits + (wordIndex < word.length ? word.length - wordIndex : query.length - queryIndex) <= 1;
}