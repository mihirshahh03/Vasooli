import { buildPaymentSummary, buildSplitSummary, simplifyDebts } from '../utils/calculations'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function toCsv(rows) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Tables({ expenses, shares, profiles }) {
  if (expenses.length === 0) {
    return <p className="hint">No expenses yet — the summary appears once you've logged something.</p>
  }

  const payment = buildPaymentSummary(expenses, profiles)
  const split = buildSplitSummary(expenses, shares, profiles)
  const settlements = simplifyDebts(
    split.rows.map((r) => ({ profileId: r.profileId, name: r.name, net: r.net }))
  )

  function download() {
    const rows = []
    rows.push(['Payment summary'])
    rows.push(['Name', ...payment.categories, 'Total paid'])
    payment.rows.forEach((r) => rows.push([r.name, ...payment.categories.map((c) => r.byCategory[c]), r.total]))
    rows.push([])
    rows.push(['Expense split summary'])
    rows.push(['Name', ...split.categories, 'Total owed', 'Total paid', 'Net'])
    split.rows.forEach((r) => rows.push([r.name, ...split.categories.map((c) => r.byCategory[c]), r.totalOwed, r.totalPaid, r.net]))
    rows.push([])
    rows.push(['Final settlement'])
    rows.push(['From', 'To', 'Amount'])
    settlements.forEach((t) => rows.push([t.from, t.to, t.amount]))

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
        {settlements.length === 0 ? (
          <p className="hint">Everyone's square.</p>
        ) : (
          <table>
            <thead>
              <tr><th>From</th><th>To</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {settlements.map((t, i) => (
                <tr key={i}>
                  <td>{t.from}</td>
                  <td>{t.to}</td>
                  <td className="bold">{fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <button className="btn-secondary" onClick={download}>Download as CSV</button>
    </div>
  )
}
