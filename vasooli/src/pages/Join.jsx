import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Join({ inviteCode, onJoined, onCancel }) {
  const [invite, setInvite] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .rpc('peek_invite', { p_invite_code: inviteCode })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setInvite(data)
        setLoading(false)
      })
  }, [inviteCode])

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const { data, error: rpcError } = await supabase.rpc('join_group_with_code', {
      p_invite_code: inviteCode,
      p_pin: pin || null,
    })
    setBusy(false)

    if (rpcError) return setError(rpcError.message)

    if (!data?.ok) {
      const messages = {
        invalid_link: 'This invite link is no longer valid. Ask for a fresh one.',
        wrong_pin: 'Wrong code. Check with whoever sent you the link.',
        too_many_attempts: 'Too many wrong tries. Wait an hour and try again.',
        not_logged_in: 'Please log in first.',
      }
      return setError(messages[data?.error] || 'Could not join this group.')
    }

    onJoined(data.group_name, data.already_member)
  }

  if (loading) {
    return <div className="screen center"><p className="hint">Checking invite…</p></div>
  }

  if (!invite?.found) {
    return (
      <div className="screen center">
        <div className="card">
          <h1 className="brand">Vasooli</h1>
          <p className="subtitle">This invite link isn't valid.</p>
          <p className="hint">It may have been rotated or the group deleted. Ask whoever sent it for a fresh link.</p>
          <button className="btn-primary full mt" onClick={onCancel}>Go to my groups</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen center">
      <div className="card">
        <h1 className="brand">Vasooli</h1>
        <p className="subtitle">
          You've been invited to join<br />
          <strong className="invite-group-name">{invite.emoji} {invite.group_name}</strong>
        </p>

        <form onSubmit={handleJoin} className="stack">
          {invite.needs_pin && (
            <>
              <label>Group code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit code"
                className="pin-input"
                autoFocus
              />
              <p className="hint small">Whoever invited you has this code.</p>
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Joining…' : 'Join group'}
          </button>
          <button type="button" className="btn-link mt" onClick={onCancel}>
            Not now
          </button>
        </form>
      </div>
    </div>
  )
}
