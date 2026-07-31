import { useEffect, useState } from 'react'
import { ArrowLeft, LogOut, Bell, BellOff } from 'lucide-react'
import { supabase, USERNAME_RULE } from '../supabaseClient'
import {
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  pushBlockedReason,
} from '../utils/push'

export default function Profile({ profile, onBack, onLogout, onProfileUpdated }) {
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const blockedReason = pushBlockedReason()

  useEffect(() => {
    getExistingSubscription().then((sub) => setPushOn(!!sub))
  }, [])

  async function togglePush() {
    setPushBusy(true)
    setPushError('')
    try {
      if (pushOn) {
        await unsubscribeFromPush()
        setPushOn(false)
      } else {
        await subscribeToPush(profile.id)
        setPushOn(true)
      }
    } catch (err) {
      setPushError(err.message)
    }
    setPushBusy(false)
  }

  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [upiId, setUpiId] = useState(profile.upi_id || '')
  const [email, setEmail] = useState(profile.email?.endsWith('@users.vasooli.app') ? '' : profile.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function saveDetails(e) {
    e.preventDefault()
    setStatus(null)

    const uname = username.trim().toLowerCase()
    if (!USERNAME_RULE.test(uname)) {
      return setStatus({ type: 'error', text: 'Username: 3–20 characters, lowercase letters, numbers or underscores.' })
    }

    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || profile.display_name,
        username: uname,
        upi_id: upiId.trim() || null,
      })
      .eq('id', profile.id)
    setBusy(false)

    if (error) {
      return setStatus({
        type: 'error',
        text: error.message.toLowerCase().includes('duplicate') ? 'That username is taken.' : error.message,
      })
    }
    setStatus({ type: 'ok', text: 'Saved.' })
    onProfileUpdated?.()
  }

  async function saveEmail(e) {
    e.preventDefault()
    setStatus(null)
    if (!email.trim()) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setBusy(false)
    if (error) return setStatus({ type: 'error', text: error.message })
    setStatus({ type: 'ok', text: 'Check your new email inbox to confirm the change.' })
  }

  async function savePassword(e) {
    e.preventDefault()
    setStatus(null)
    if (newPassword.length < 6) return setStatus({ type: 'error', text: 'Password must be at least 6 characters.' })
    if (newPassword !== confirmPassword) return setStatus({ type: 'error', text: "Passwords don't match." })

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) return setStatus({ type: 'error', text: error.message })
    setNewPassword('')
    setConfirmPassword('')
    setStatus({ type: 'ok', text: 'Password updated.' })
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <span className="hello">Profile</span>
        <button className="icon-btn" onClick={onLogout} title="Log out"><LogOut size={20} /></button>
      </header>

      <div className="content narrow">
        <form onSubmit={saveDetails} className="stack section-block">
          <h3>Your details</h3>
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
            autoCapitalize="none"
          />
          <label>UPI ID <span className="faint">(optional)</span></label>
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@oksbi" autoCapitalize="none" />
          <button type="submit" className="btn-primary" disabled={busy}>Save details</button>
        </form>

        <form onSubmit={saveEmail} className="stack section-block">
          <h3>Email</h3>
          <p className="hint">Used for password reset. Changing it sends a confirmation link to the new address.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button type="submit" className="btn-secondary" disabled={busy}>Update email</button>
        </form>

        <div className="stack section-block">
          <h3>Notifications</h3>
          {blockedReason ? (
            <p className="hint">{blockedReason}</p>
          ) : (
            <>
              <p className="hint">
                Get a notification when someone adds an expense to one of your groups.
              </p>
              <button
                type="button"
                className={pushOn ? 'btn-secondary' : 'btn-primary'}
                onClick={togglePush}
                disabled={pushBusy}
              >
                {pushBusy ? 'Just a sec…' : pushOn ? (
                  <><BellOff size={15} /> Turn off notifications</>
                ) : (
                  <><Bell size={15} /> Turn on notifications</>
                )}
              </button>
            </>
          )}
          {pushError && <p className="error">{pushError}</p>}
        </div>

        <form onSubmit={savePassword} className="stack section-block">
          <h3>Change password</h3>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
          <button type="submit" className="btn-secondary" disabled={busy}>Update password</button>
        </form>

        {status && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}
      </div>
    </div>
  )
}
