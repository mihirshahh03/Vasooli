import { useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ExpenseDetail from './ExpenseDetail'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const SPLIT_LABEL = { equal: 'Equal', custom: 'Custom', per_unit: 'Per unit' }

function SwipeRow({ expense, canEdit, nameOf, onEdit, onOpen, onRequestDelete }) {
  const startX = useRef(0)
  const [dx, setDx] = useState(0)
  const [swiping, setSwiping] = useState(false)

  function onTouchStart(e) { startX.current = e.touches[0].clientX; setSwiping(true) }
  function onTouchMove(e) {
    const delta = e.touches[0].clientX - startX.current
    setDx(Math.max(-88, Math.min(0, delta)))
  }
  function onTouchEnd() {
    setSwiping(false)
    if (dx < -50) setDx(-88); else setDx(0)
  }

  return (
    <div className="swipe-wrap">
      <div className="swipe-delete-bg" onClick={() => { setDx(0); onRequestDelete(expense) }}>
        Delete
      </div>
      <div
        className="expense-row"
        style={{ transform: `translateX(${dx}px)`, transition: swiping ? 'none' : 'transform 0.2s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="expense-row-tap" onClick={() => onOpen(expense)}>
          <div className="expense-title">{expense.description}</div>
          <div className="expense-meta">
            {nameOf(expense.paid_by)} paid · {SPLIT_LABEL[expense.split_type]}
            {expense.original_currency && <> · {expense.original_amount} {expense.original_currency}</>}
          </div>
        </div>
        <div className="expense-right">
          <span className="expense-amount">{fmt(expense.total_amount)}</span>
          {canEdit && (
            <button className="icon-btn" onClick={() => onEdit(expense)} title="Edit" type="button">
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExpenseList({ expenses, members, profile, myRole, onEdit, onChanged }) {
  const [pendingDelete, setPendingDelete] = useState(null)
  const [openExpense, setOpenExpense] = useState(null)
  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || 'Someone'

  async function confirmDelete() {
    const expense = pendingDelete
    setPendingDelete(null)
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return alert(error.message)
    onChanged()
  }

  if (expenses.length === 0) {
    return <p className="hint">Nothing logged yet. Add your first expense above.</p>
  }

  return (
    <div className="stack-list">
      <p className="hint small">Tap an expense to comment. Swipe left to delete. ✎ to edit.</p>
      {expenses.map((e) => (
        <SwipeRow
          key={e.id}
          expense={e}
          canEdit={e.created_by === profile.id || myRole === 'admin'}
          nameOf={nameOf}
          onEdit={onEdit}
          onOpen={setOpenExpense}
          onRequestDelete={setPendingDelete}
        />
      ))}

      {pendingDelete && (
        <Modal
          title="Delete this expense?"
          body={`"${pendingDelete.description}" (${fmt(pendingDelete.total_amount)}) will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {openExpense && (
        <ExpenseDetail
          expense={openExpense}
          members={members}
          profile={profile}
          onClose={() => setOpenExpense(null)}
        />
      )}
    </div>
  )
}
