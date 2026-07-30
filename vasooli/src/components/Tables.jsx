import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { buildPaymentSummary, buildSplitSummary, applySettlements, simplifyDebts } from '../utils/calculations'
import Modal from './Modal'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Tables({ group, expenses, shares, settlements, profiles, myId, onChanged }) {
  const [pendingSettle, setPendingSettle] = useState(null)
  const [saving, setSaving] = useState(false)
  const [payToId, setPayToId] = useState('')

  if (expenses.length === 0) {
    return <p className="hint">No expenses yet — the summary appears once you've logged something.</p>
  }

  const payment = buildPaymentSummary(expenses, profiles)
  const split = buildSplitSummary(expenses, shares, profiles)
  const rawNet = split.rows.map((r) => ({ profileId: r.profileId, name: r.name, net: r.net }))
  const nettedBalances = applySettlements(rawNet, settlements)
  const settlementsToMake = simplifyDebts(nettedBalances)

  function profileById(id) {
    return profiles.find((p) => p.id === id)
  }

  const payableMembers = profiles.filter((p) => p.id !== myId && p.upi_id)
  const payTo = profileById(payToId)
  // If there's an actual amount you owe this specific person right now, prefill it automatically.
  const matchingSettlement = settlementsToMake.find((t) => t.fromId === myId && t.toId === payToId)

  function appLink(scheme) {
    if (!payTo) return scheme
    const params = new URLSearchParams({ pa: payTo.upi_id, pn: payTo.display_name, cu: 'INR' })
    if (matchingSettlement) params.set('am', matchingSettlement.amount.toFixed(2))
    return `${scheme}?${params.toString()}`
  }

  async function confirmSettle() {
    const t = pendingSettle
    setPendingSettle(null)

    setSaving(true)
    const { error } = await supabase.from('settlements').insert({
      group_id: group.id,
      from_profile_id: t.fromId,
      to_profile_id: t.toId,
      amount: t.amount,
      created_by: myId,
    })
    setSaving(false)
    if (error) return alert(error.message)
    onChanged()
  }

  async function undoSettlement(settlementId) {
    setSaving(true)
    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
    setSaving(false)
    if (error) return alert(error.message)
    onChanged()
  }

  function download() {
    const rows = []
    rows.push(['Payment summary'])
    rows.push(['Name', ...payment.categories, 'Total paid'])
    payment.rows.forEach((r) => rows.push([r.name, ...payment.categories.map((c) => r.byCategory[c]), r.total]))
    rows.push([])
    rows.push(['Expense split summary'])
    rows.push(['Name', ...split.categories, 'Total owed', 'Total paid', 'Net (before settlements)'])
    split.rows.forEach((r) => rows.push([r.name, ...split.categories.map((c) => r.byCategory[c]), r.totalOwed, r.totalPaid, r.net]))
    rows.push([])
    rows.push(['Settle up (after recorded settlements)'])
    rows.push(['From', 'To', 'Amount'])
    settlementsToMake.forEach((t) => rows.push([t.from, t.to, t.amount]))

    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vasooli-summary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tables">
      <section>
        <h3>Who paid what</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {payment.categories.map((c) => <th key={c}>{c}</th>)}
                <th>Total paid</th>
              </tr>
            </thead>
            <tbody>
              {payment.rows.map((r) => (
                <tr key={r.profileId}>
                  <td>{r.name}</td>
                  {payment.categories.map((c) => <td key={c}>{fmt(r.byCategory[c])}</td>)}
                  <td className="bold">{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Everyone's share</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {split.categories.map((c) => <th key={c}>{c}</th>)}
                <th>Owed</th>
                <th>Paid</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {split.rows.map((r) => (
                <tr key={r.profileId}>
                  <td>{r.name}</td>
                  {split.categories.map((c) => <td key={c}>{fmt(r.byCategory[c])}</td>)}
                  <td className="bold">{fmt(r.totalOwed)}</td>
                  <td>{fmt(r.totalPaid)}</td>
                  <td className={r.net >= 0 ? 'positive' : 'negative'}>
                    {r.net >= 0 ? '+' : '−'}{fmt(Math.abs(r.net))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Settle up</h3>
        {settlementsToMake.length === 0 ? (
          <p className="hint">Everyone's square.</p>
        ) : (
          <div className="stack-list">
            {settlementsToMake.map((t, i) => (
              <div key={i} className="settle-row">
                <div>
                  <strong>{t.from}</strong> → <strong>{t.to}</strong>
                  <div className="expense-meta">{fmt(t.amount)}</div>
                </div>
                <button className="btn-primary" onClick={() => setPendingSettle(t)} disabled={saving}>
                  Mark settled
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>Pay now</h3>
        {payableMembers.length === 0 ? (
          <p className="hint">
            Nobody's added a UPI ID yet — ask the person you're paying to add one in Profile settings.
          </p>
        ) : (
          <>
            <label className="hint">Pay to</label>
            <select value={payToId} onChange={(e) => setPayToId(e.target.value)}>
              <option value="">Choose a person…</option>
              {payableMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
            {payTo && matchingSettlement && (
              <p className="hint small">Amount will auto-fill: {fmt(matchingSettlement.amount)}</p>
            )}
            <div className="quick-pay-row">
              <a
                className={`quick-pay-btn ${!payTo ? 'disabled' : ''}`}
                href={payTo ? appLink('gpay://upi/pay') : undefined}
                onClick={(e) => !payTo && e.preventDefault()}
              >
                Google Pay
              </a>
              <a
                className={`quick-pay-btn ${!payTo ? 'disabled' : ''}`}
                href={payTo ? appLink('phonepe://pay') : undefined}
                onClick={(e) => !payTo && e.preventDefault()}
              >
                PhonePe
              </a>
              <a
                className={`quick-pay-btn ${!payTo ? 'disabled' : ''}`}
                href={payTo ? appLink('paytmmp://pay') : undefined}
                onClick={(e) => !payTo && e.preventDefault()}
              >
                Paytm
              </a>
            </div>
          </>
        )}
      </section>

      <section>
        <h3>Recently settled</h3>
        {settlements.length === 0 ? (
          <p className="hint">Nothing recorded yet.</p>
        ) : (
          <div className="stack-list">
            {[...settlements].reverse().slice(0, 10).map((s) => {
              const fromP = profileById(s.from_profile_id)
              const toP = profileById(s.to_profile_id)
              return (
                <div key={s.id} className="settle-row">
                  <div>
                    <strong>{fromP?.display_name || 'Someone'}</strong> → <strong>{toP?.display_name || 'someone'}</strong>
                    <div className="expense-meta">{fmt(s.amount)}</div>
                  </div>
                  <button className="btn-link" onClick={() => undoSettlement(s.id)} disabled={saving}>
                    Undo
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <button className="btn-secondary" onClick={download}>Download as CSV</button>

      {pendingSettle && (
        <Modal
          title="Mark as settled?"
          body={`Record that ${pendingSettle.from} paid ${pendingSettle.to} ${fmt(pendingSettle.amount)}. This removes it from the Settle Up list.`}
          confirmLabel="Mark settled"
          onConfirm={confirmSettle}
          onCancel={() => setPendingSettle(null)}
        />
      )}
    </div>
  )
}
