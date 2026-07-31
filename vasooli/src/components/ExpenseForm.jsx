import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeEqualShares, computePerUnitShares, auditShares } from '../utils/calculations'
import { CURRENCIES, convertToINR } from '../utils/currency'
import { notifyGroup } from '../utils/push'
import Modal from './Modal'

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export default function ExpenseForm({ group, members, profile, existingExpense, existingShares, onSaved, onCancel }) {
  const isEdit = !!existingExpense
  const [description, setDescription] = useState(existingExpense?.description || '')
  const [category, setCategory] = useState(existingExpense?.category || '')
  const [paidBy, setPaidBy] = useState(existingExpense?.paid_by || profile.id)
  const [totalAmount, setTotalAmount] = useState(existingExpense?.total_amount?.toString() || '')
  const [splitType, setSplitType] = useState(existingExpense?.split_type || 'equal')

  const [currency, setCurrency] = useState(existingExpense?.original_currency || 'INR')
  const [rate, setRate] = useState(existingExpense?.exchange_rate || 1)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState('')

  useEffect(() => {
    if (currency === 'INR') { setRate(1); setRateError(''); return }
    setRateLoading(true)
    setRateError('')
    convertToINR(1, currency)
      .then(({ rate }) => setRate(rate))
      .catch(() => setRateError("Couldn't fetch today's rate. Try again in a moment."))
      .finally(() => setRateLoading(false))
  }, [currency])

  // The amount typed is in `currency`; inrTotal is what actually drives every split calc.
  const inrTotal = currency === 'INR' ? Number(totalAmount || 0) : round2(Number(totalAmount || 0) * rate)

  const initialIncluded = existingShares
    ? Object.fromEntries(members.map((m) => [m.id, existingShares.some((s) => s.profile_id === m.id)]))
    : Object.fromEntries(members.map((m) => [m.id, true]))
  const [included, setIncluded] = useState(initialIncluded)

  const initialCustom = existingShares
    ? Object.fromEntries(existingShares.map((s) => [s.profile_id, String(s.share_amount)]))
    : {}
  const [customAmounts, setCustomAmounts] = useState(initialCustom)

  const meta = existingExpense?.meta || {}
  const [unitPrice, setUnitPrice] = useState(meta.unitPrice || '')
  const [units, setUnits] = useState(meta.units || Object.fromEntries(members.map((m) => [m.id, 0])))

  const [audit, setAudit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pendingMismatch, setPendingMismatch] = useState(null)

  const toggle = (id) => setIncluded((p) => ({ ...p, [id]: !p[id] }))
  const setAll = (value) => setIncluded(Object.fromEntries(members.map((m) => [m.id, value])))

  function computeShares() {
    if (splitType === 'equal') {
      const ids = members.filter((m) => included[m.id]).map((m) => m.id)
      if (!ids.length) return {}
      return computeEqualShares(inrTotal, ids)
    }
    if (splitType === 'custom') {
      const shares = {}
      members.forEach((m) => {
        if (included[m.id]) shares[m.id] = Number(customAmounts[m.id] || 0)
      })
      return shares
    }
    return computePerUnitShares(Number(unitPrice || 0), units)
  }

  function checkTotals() {
    const result = auditShares(computeShares(), inrTotal)
    setAudit(result)
    return result
  }

  async function reallySave() {
    const shares = computeShares()
    setSaving(true)

    const payload = {
      description: description.trim(),
      category: category.trim() || description.trim(),
      paid_by: paidBy,
      total_amount: inrTotal,
      split_type: splitType,
      meta: { units, unitPrice, included },
      original_currency: currency === 'INR' ? null : currency,
      original_amount: currency === 'INR' ? null : Number(totalAmount),
      exchange_rate: currency === 'INR' ? null : rate,
    }

    let expenseId = existingExpense?.id

    if (isEdit) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', expenseId)
      if (error) {
        setSaving(false)
        return alert(error.message)
      }
      await supabase.from('expense_shares').delete().eq('expense_id', expenseId)
    } else {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({ ...payload, group_id: group.id, created_by: profile.id })
        .select()
        .single()
      if (error) {
        setSaving(false)
        return alert(error.message)
      }
      expenseId = expense.id
    }

    const rows = Object.entries(shares).map(([profile_id, share_amount]) => ({
      expense_id: expenseId,
      profile_id,
      share_amount,
    }))
    const { error: shareError } = await supabase.from('expense_shares').insert(rows)
    setSaving(false)
    if (shareError) return alert(shareError.message)

    // Only announce brand-new expenses -- editing shouldn't ping everyone again.
    if (!isEdit) {
      notifyGroup({
        groupId: group.id,
        actorId: profile.id,
        title: group.name,
        body: `${profile.display_name} added "${description.trim()}" — ${fmtInr(inrTotal)}`,
      })
    }

    onSaved()
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!description.trim() || !paidBy || !totalAmount) return

    const shares = computeShares()
    if (!Object.keys(shares).length) {
      alert('Nobody is included in this split yet.')
      return
    }

    const result = checkTotals()
    if (!result.ok) {
      setPendingMismatch(result)
      return
    }
    reallySave()
  }

  return (
    <form className="panel stack" onSubmit={handleSave}>
      <h3>{isEdit ? 'Edit expense' : 'Add expense'}</h3>

      <label>What was it?</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Day 1 breakfast" required />

      <label>Category <span className="faint">(optional — groups columns in the summary)</span></label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Food" />

      <label>Who paid?</label>
      <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      {group.is_international ? (
        <>
          <label>Amount</label>
          <div className="amount-currency-row">
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">INR</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {currency !== 'INR' && (
            rateLoading ? (
              <p className="hint small">Fetching today's rate…</p>
            ) : rateError ? (
              <p className="warning">{rateError}</p>
            ) : (
              <p className="hint small">≈ {fmtInr(inrTotal)} at today's rate (1 {currency} = ₹{rate.toFixed(2)})</p>
            )
          )}
        </>
      ) : (
        <>
          <label>Total (₹)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
        </>
      )}

      <label>How to split</label>
      <div className="tab-row tight">
        <button type="button" className={splitType === 'equal' ? 'active' : ''} onClick={() => setSplitType('equal')}>Equally</button>
        <button type="button" className={splitType === 'custom' ? 'active' : ''} onClick={() => setSplitType('custom')}>Set amounts</button>
        <button type="button" className={splitType === 'per_unit' ? 'active' : ''} onClick={() => setSplitType('per_unit')}>Per unit</button>
      </div>

      {(splitType === 'equal' || splitType === 'custom') && (
        <div className="stack">
          <div className="row-between">
            <span className="hint">
              {splitType === 'equal' ? 'Split between' : 'Include, and set each amount'}
            </span>
            <span>
              <button type="button" className="btn-link" onClick={() => setAll(true)}>All</button>
              {' · '}
              <button type="button" className="btn-link" onClick={() => setAll(false)}>None</button>
            </span>
          </div>
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <label className="checkbox-row">
                <input type="checkbox" checked={!!included[m.id]} onChange={() => toggle(m.id)} />
                {m.display_name}
              </label>
              {splitType === 'custom' && included[m.id] && (
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="amount-input"
                  placeholder="0"
                  value={customAmounts[m.id] || ''}
                  onChange={(e) => setCustomAmounts((p) => ({ ...p, [m.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {splitType === 'per_unit' && (
        <div className="stack">
          <label>Price per unit (₹)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="200"
          />
          <span className="hint">How many each person had</span>
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <span>{m.display_name}</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="amount-input"
                value={units[m.id] || 0}
                onChange={(e) => setUnits((p) => ({ ...p, [m.id]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-secondary" onClick={checkTotals}>Check the maths</button>
      {audit && (
        audit.ok
          ? <p className="success">Shares add up to the total exactly.</p>
          : <p className="warning">
              Shares add up to {fmtInr(audit.computedTotal)}, but the total says {fmtInr(inrTotal)} — off by {fmtInr(Math.abs(audit.diff))}.
            </p>
      )}

      <div className="row-between mt">
        <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save expense'}
        </button>
      </div>

      {pendingMismatch && (
        <Modal
          title="Numbers don't quite match"
          body={`The shares add up to ${fmtInr(pendingMismatch.computedTotal)}, but the total is ${fmtInr(inrTotal)} (off by ${fmtInr(Math.abs(pendingMismatch.diff))}). Save anyway using the total?`}
          confirmLabel="Save anyway"
          onConfirm={() => { setPendingMismatch(null); reallySave() }}
          onCancel={() => setPendingMismatch(null)}
        />
      )}
    </form>
  )
}

function fmtInr(n) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
