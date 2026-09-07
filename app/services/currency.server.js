// Currency conversion and formatting service for Shopify Markets
const DEFAULT_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  AUD: 1.52,
  INR: 83.5,
  JPY: 155.0,
};

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
  JPY: "¥",
};

export function convertCurrency(amount, fromCurrency = "USD", toCurrency = "USD") {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return parseFloat(amount);

  const fromRate = DEFAULT_RATES[from] || 1.0;
  const toRate = DEFAULT_RATES[to] || 1.0;

  // Convert to USD base then to target currency
  const inUSD = parseFloat(amount) / fromRate;
  const converted = inUSD * toRate;

  return parseFloat(converted.toFixed(2));
}

export function formatCurrency(amount, currency = "USD") {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || `${currency} `;
  const num = parseFloat(amount || 0).toFixed(2);
  return `${symbol}${num}`;
}

export function getSupportedCurrencies() {
  return Object.keys(DEFAULT_RATES);
}
