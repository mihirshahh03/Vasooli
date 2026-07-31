// Curated for where Indian travelers actually go — not just the major world currencies.
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'AED', 'SGD', 'THB', 'IDR', 'MYR', 'VND',
  'NPR', 'LKR', 'MVR', 'AUD', 'JPY', 'HKD', 'NZD', 'TRY', 'GEL',
  'KZT', 'EGP', 'QAR', 'SAR', 'CHF', 'CAD', 'ZAR',
]

/**
 * Fetches today's rate to convert `amount` of `fromCurrency` into INR,
 * using the free Frankfurter API v2 (165 currencies, not just the ~30 major
 * ones the older v1 endpoint covers — v2 is needed for AED, NPR, LKR, etc.)
 * Returns { inrAmount, rate } or throws if the request fails.
 */
export async function convertToINR(amount, fromCurrency) {
  if (fromCurrency === 'INR') return { inrAmount: Number(amount), rate: 1 }

  const res = await fetch(`https://api.frankfurter.dev/v2/rate/${fromCurrency}/INR`)
  if (!res.ok) throw new Error(`No rate available for ${fromCurrency}.`)
  const data = await res.json()
  const rate = data.rate
  if (!rate) throw new Error(`No rate available for ${fromCurrency}.`)
  return { inrAmount: Math.round(Number(amount) * rate * 100) / 100, rate }
}
