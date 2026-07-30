import { useEffect, useState } from 'react'
import { X, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export default function ExpenseDetail({ expense, members, profile, onClose }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const nameOf = (id) => members.find((m) => m.id === id)?.display_name || 'Someone'

  async function loadComments() {
    setLoading(true)
    const { data } = await supabase
      .from('expense_comments')
      .select('*')
      .eq('expense_id', expense.id)
      .order('created_at')
    setComments(data || [])
    setLoading(false)
  }

  useEffect(() => { loadComments() }, [expense.id])

  async function sendComment(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    const { error } = await supabase.from('expense_comments').insert({
      expense_id: expense.id,
      profile_id: profile.id,
      message: text.trim(),
    })
    setSending(false)
    if (error) return alert(error.message)
    setText('')
    loadComments()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h3>{expense.description}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="expense-meta">
          {nameOf(expense.paid_by)} paid {fmt(expense.total_amount)}
          {expense.original_currency && expense.original_currency !== 'INR' && (
            <> · originally {expense.original_amount} {expense.original_currency}</>
          )}
        </p>

        <div className="comment-thread">
          {loading ? (
            <p className="hint">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="hint">No comments yet — ask a question about this expense.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment-row">
                <strong>{nameOf(c.profile_id)}</strong>
                <span>{c.message}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendComment} className="comment-form">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
          />
          <button type="submit" className="icon-btn" disabled={sending}><Send size={18} /></button>
        </form>
      </div>
    </div>
  )
}
