// Amounts are stored in minor units (kobo for NGN, cents for USD).
export function formatMoney(minor: number, currency = "NGN", options: { decimals?: boolean } = {}) {
  const decimals = options.decimals ?? currency !== "NGN";
  try {
    return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function currencySymbol(currency = "NGN") {
  return formatMoney(0, currency, { decimals: false }).replace(/[\d\s.,]/g, "") || currency;
}
