// Common currencies an Indian traveler would actually hit abroad.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'THB', 'AUD', 'JPY', 'CHF', 'CAD', 'NPR', 'LKR']

/**
 * Fetches today's rate to convert `amount` of `fromCurrency` into INR,
 * using the free Frankfurter API (ECB data, no key, no limits).
 * Returns { inrAmount, rate } or throws if the request fails.
 */
export async function convertToINR(amount, fromCurrency) {
  if (fromCurrency === 'INR') return { inrAmount: Number(amount), rate: 1 }

  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${fromCurrency}&symbols=INR`)
  if (!res.ok) throw new Error('Could not fetch exchange rate right now.')
  const data = await res.json()
  const rate = data.rates?.INR
  if (!rate) throw new Error(`No rate available for ${fromCurrency}.`)
  return { inrAmount: Math.round(Number(amount) * rate * 100) / 100, rate }
}
