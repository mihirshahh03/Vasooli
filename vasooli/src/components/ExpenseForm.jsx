import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeEqualShares, computePerUnitShares, auditShares } from '../utils/calculations'

export default function ExpenseForm({ group, members, profile, onSaved, onCancel }) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [paidBy, setPaidBy] = useState(profile.id)
  const [totalAmount, setTotalAmount] = useState('')
  const [splitType, setSplitType] = useState('equal')

  const [included, setIncluded] = useState(() =>
    Object.fromEntries(members.map((m) => [m.id, true]))
  )
  const [customAmounts, setCustomAmounts] = useState({})
  const [unitPrice, setUnitPrice] = useState('')
  const [units, setUnits] = useState(() => Object.fromEntries(members.map((m) => [m.id, 0])))

  const [audit, setAudit] = useState(null)
  const [saving, setSaving] = useState(false)

  const toggle = (id) => setIncluded((p) => ({ ...p, [id]: !p[id] }))
  const setAll = (value) =>
    setIncluded(Object.fromEntries(members.map((m) => [m.id, value])))

  function computeShares() {
    if (splitType === 'equal') {
      const ids = members.filter((m) => included[m.id]).map((m) => m.id)
      if (!ids.length) return {}
      return computeEqualShares(Number(totalAmount || 0), ids)
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
    const result = auditShares(computeShares(), Number(totalAmount || 0))
    setAudit(result)
    return result
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
      const proceed = confirm(
        `The shares add up to ₹${result.computedTotal}, but you entered ₹${totalAmount} ` +
        `(off by ₹${Math.abs(result.diff)}).\n\nSave anyway?`
      )
      if (!proceed) return
    }

    setSaving(true)
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        group_id: group.id,
        description: description.trim(),
        category: category.trim() || description.trim(),
        paid_by: paidBy,
        total_amount: Number(totalAmount),
        split_type: splitType,
        created_by: profile.id,
        meta: { units, unitPrice, included },
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      return alert(error.message)
    }

    const rows = Object.entries(shares).map(([profile_id, share_amount]) => ({
      expense_id: expense.id,
      profile_id,
      share_amount,
    }))
    const { error: shareError } = await supabase.from('expense_shares').insert(rows)
    setSaving(false)
    if (shareError) return alert(shareError.message)
    onSaved()
  }

  return (
    <form className="panel stack" onSubmit={handleSave}>
      <h3>Add expense</h3>

      <label>What was it?</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Day 1 breakfast"
        required
      />

      <label>Category <span className="faint">(optional — groups columns in the summary)</span></label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Food" />

      <label>Who paid?</label>
      <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      <label>Total (₹)</label>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        value={totalAmount}
        onChange={(e) => setTotalAmount(e.target.value)}
        required
      />

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
              Shares add up to ₹{audit.computedTotal}, but the total says ₹{totalAmount} — off by ₹{Math.abs(audit.diff)}.
            </p>
      )}

      <div className="row-between mt">
        <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save expense'}
        </button>
      </div>
    </form>
  )
}
