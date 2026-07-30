import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfileSettings({ profile, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [upiId, setUpiId] = useState(profile.upi_id || '')
  const [email, setEmail] = useState(profile.email?.endsWith('@users.vasooli.app') ? '' : profile.email || '')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const hasRealEmail = profile.email && !profile.email.endsWith('@users.vasooli.app')

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || profile.display_name, upi_id: upiId.trim() || null })
      .eq('id', profile.id)

    let emailNotice = ''
    if (email.trim() && email.trim() !== profile.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() })
      if (emailError) {
        setBusy(false)
        return setStatus({ type: 'error', text: emailError.message })
      }
      emailNotice = ' Check your new email inbox to confirm it.'
    }

    setBusy(false)
    if (profileError) return setStatus({ type: 'error', text: profileError.message })
    setStatus({ type: 'ok', text: 'Saved.' + emailNotice })
    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <h3>Profile settings</h3>
        <form onSubmit={handleSave} className="stack">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

          <label>UPI ID <span className="faint">(optional — lets friends pay you with one tap)</span></label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@oksbi"
          />

          <label>
            Email <span className="faint">
              {hasRealEmail ? '(for password reset)' : '(optional — lets you reset your password yourself)'}
            </span>
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

          {status && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-link" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
