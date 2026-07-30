import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError("Passwords don't match.")

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <div className="screen center">
      <div className="card">
        <h1 className="brand">Vasooli</h1>
        <p className="subtitle">Set a new password</p>
        <form onSubmit={handleSubmit} className="stack">
          <label>New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
