// All the money math lives here, separate from UI code, so it can be tested/trusted on its own.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Equal split across a list of participant profile IDs. */
export function computeEqualShares(totalAmount, participantIds) {
  const each = round2(totalAmount / participantIds.length)
  const shares = {}
  participantIds.forEach((id) => (shares[id] = each))
  // Fix rounding drift: give any leftover paise to the first participant
  const drift = round2(totalAmount - each * participantIds.length)
  if (drift !== 0) shares[participantIds[0]] = round2(shares[participantIds[0]] + drift)
  return shares
}

/** Custom split: caller supplies exact shares per person (e.g. "only these 3 people, equally or not"). */
export function computeCustomShares(sharesMap) {
  return { ...sharesMap }
}

/** Per-unit split: e.g. Corona at 200/bottle, different people drank different counts. */
export function computePerUnitShares(unitPrice, unitsMap) {
  const shares = {}
  Object.entries(unitsMap).forEach(([profileId, units]) => {
    if (units > 0) shares[profileId] = round2(units * unitPrice)
  })
  return shares
}

/**
 * Audit check: does the sum of individual shares match the stated total?
 * Returns { ok, computedTotal, diff }. Surfacing `diff` lets the UI ask
 * "here's the gap, how do you want to resolve it" instead of silently accepting bad data.
 */
export function auditShares(shares, statedTotal) {
  const computedTotal = round2(Object.values(shares).reduce((a, b) => a + b, 0))
  const diff = round2(statedTotal - computedTotal)
  return { ok: diff === 0, computedTotal, diff }
}

/**
 * Table 1: Payment Summary -- who paid how much, per expense category.
 * expenses: [{ id, description, category, paid_by, total_amount }]
 * profiles: [{ id, name }]
 * Returns { rows: [{ profileId, name, byCategory: {cat: amt}, total }], categories: [...] }
 */
export function buildPaymentSummary(expenses, profiles) {
  const categories = [...new Set(expenses.map((e) => e.category || e.description))]
  const rows = profiles.map((p) => {
    const byCategory = {}
    categories.forEach((c) => (byCategory[c] = 0))
    let total = 0
    expenses
      .filter((e) => e.paid_by === p.id)
      .forEach((e) => {
        const cat = e.category || e.description
        byCategory[cat] = round2(byCategory[cat] + Number(e.total_amount))
        total = round2(total + Number(e.total_amount))
      })
    return { profileId: p.id, name: p.display_name, byCategory, total }
  })
  return { rows, categories }
}

/**
 * Table 2: Expense Split Summary -- who owes how much, per category, plus paid/net.
 * shares: [{ expense_id, profile_id, share_amount }]
 * expenses: as above (need category + paid_by + total_amount per expense)
 */
export function buildSplitSummary(expenses, shares, profiles) {
  const categories = [...new Set(expenses.map((e) => e.category || e.description))]
  const expenseById = Object.fromEntries(expenses.map((e) => [e.id, e]))

  const rows = profiles.map((p) => {
    const byCategory = {}
    categories.forEach((c) => (byCategory[c] = 0))
    let totalOwed = 0
    shares
      .filter((s) => s.profile_id === p.id)
      .forEach((s) => {
        const exp = expenseById[s.expense_id]
        if (!exp) return
        const cat = exp.category || exp.description
        byCategory[cat] = round2(byCategory[cat] + Number(s.share_amount))
        totalOwed = round2(totalOwed + Number(s.share_amount))
      })

    const totalPaid = round2(
      expenses.filter((e) => e.paid_by === p.id).reduce((sum, e) => sum + Number(e.total_amount), 0)
    )
    const net = round2(totalPaid - totalOwed)
    return { profileId: p.id, name: p.display_name, byCategory, totalOwed, totalPaid, net }
  })
  return { rows, categories }
}

/**
 * Subtract already-recorded settlement payments from net balances before
 * simplifying debts, so a payment someone already made doesn't keep showing up.
 * settlements: [{ from_profile_id, to_profile_id, amount }]
 * netBalances: [{ profileId, name, net }]  (net = paid - owed, before settlements)
 */
export function applySettlements(netBalances, settlements) {
  const adjusted = Object.fromEntries(netBalances.map((p) => [p.profileId, p.net]))
  settlements.forEach((s) => {
    // If A paid B, A's effective net goes up (their debt shrinks) and B's goes down
    // (they've already received it, so they're owed less going forward).
    if (adjusted[s.from_profile_id] !== undefined) {
      adjusted[s.from_profile_id] = round2(adjusted[s.from_profile_id] + Number(s.amount))
    }
    if (adjusted[s.to_profile_id] !== undefined) {
      adjusted[s.to_profile_id] = round2(adjusted[s.to_profile_id] - Number(s.amount))
    }
  })
  return netBalances.map((p) => ({ ...p, net: adjusted[p.profileId] }))
}

/**
 * Table 3: Final Settlement -- minimal list of "who pays whom" transactions,
 * using a greedy match-largest-creditor-with-largest-debtor algorithm (same idea
 * as Splitwise's "simplify debts").
 * netBalances: [{ profileId, name, net }]  (net = paid - owed)
 */
export function simplifyDebts(netBalances) {
  const creditors = netBalances.filter((p) => p.net > 0.005).map((p) => ({ ...p })).sort((a, b) => b.net - a.net)
  const debtors = netBalances.filter((p) => p.net < -0.005).map((p) => ({ ...p, net: -p.net })).sort((a, b) => b.net - a.net)

  const transactions = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = round2(Math.min(debtor.net, creditor.net))
    if (amount > 0) {
      transactions.push({
        from: debtor.name,
        to: creditor.name,
        fromId: debtor.profileId,
        toId: creditor.profileId,
        amount,
      })
    }
    debtor.net = round2(debtor.net - amount)
    creditor.net = round2(creditor.net - amount)
    if (debtor.net <= 0.005) i++
    if (creditor.net <= 0.005) j++
  }
  return transactions
}

/** Builds a UPI deep link. Opens the person's UPI app (GPay/PhonePe/etc.) with
 * the amount and payee pre-filled -- we never see or touch the actual payment. */
export function buildUpiLink({ upiId, payeeName, amount, note }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: note || 'Vasooli settle up',
  })
  return `upi://pay?${params.toString()}`
}
