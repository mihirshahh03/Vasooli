import { supabase } from '../supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const SPLIT_LABEL = {
  equal: 'Equal',
  custom: 'Custom',
  per_unit: 'Per unit',
}

export default function ExpenseList({ expenses, members, onChanged }) {
  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || 'Someone'

  async function remove(expense) {
    if (!confirm(`Delete "${expense.description}"? This can't be undone.`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return alert(error.message)
    onChanged()
  }

  if (expenses.length === 0) {
    return <p className="hint">Nothing logged yet. Add your first expense above.</p>
  }

  return (
    <div className="stack-list">
      {expenses.map((e) => (
        <div key={e.id} className="expense-row">
          <div>
            <div className="expense-title">{e.description}</div>
            <div className="expense-meta">
              {nameOf(e.paid_by)} paid · {SPLIT_LABEL[e.split_type]}
            </div>
          </div>
          <div className="expense-right">
            <span className="expense-amount">{fmt(e.total_amount)}</span>
            <button className="btn-x" onClick={() => remove(e)} title="Delete" type="button">×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
