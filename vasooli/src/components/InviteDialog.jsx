import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function InviteDialog({ group, onClose, onUpdated }) {
  const [pin, setPin] = useState('')
  const [inviteCode, setInviteCode] = useState(group.invite_code)
  const [hasPin, setHasPin] = useState(!!group.invite_pin_hash)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const link = `${window.location.origin}/?join=${inviteCode}`

  async function savePin(e) {
    e.preventDefault()
    if (pin && !/^\d{4}$/.test(pin)) {
      return setStatus({ type: 'error', text: 'Code must be exactly 4 digits.' })
    }
    setBusy(true)
    setStatus(null)
    const { data, error } = await supabase.rpc('set_group_invite', {
      p_group_id: group.id,
      p_pin: pin || null,
      p_rotate: false,
    })
    setBusy(false)
    if (error) return setStatus({ type: 'error', text: error.message })
    if (!data?.ok) return setStatus({ type: 'error', text: 'Only the group admin can change this.' })

    setHasPin(!!pin)
    setStatus({ type: 'ok', text: pin ? 'Code set. Share it separately from the link.' : 'Code removed — anyone with the link can join.' })
    onUpdated?.()
  }

  async function rotateLink() {
    setBusy(true)
    setStatus(null)
    const { data, error } = await supabase.rpc('set_group_invite', {
      p_group_id: group.id,
      p_pin: pin || null,
      p_rotate: true,
    })
    setBusy(false)
    if (error) return setStatus({ type: 'error', text: error.message })
    if (!data?.ok) return setStatus({ type: 'error', text: 'Only the group admin can do this.' })
    setInviteCode(data.invite_code)
    setStatus({ type: 'ok', text: 'New link generated. The old one no longer works.' })
    onUpdated?.()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus({ type: 'error', text: 'Copy failed — select the link and copy it manually.' })
    }
  }

  function shareOnWhatsApp() {
    const text = hasPin
      ? `Join our Vasooli group "${group.name}": ${link}\n\n(I'll send you the 4-digit code separately)`
      : `Join our Vasooli group "${group.name}": ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <h3>Invite people</h3>
        <p className="modal-body">
          Anyone with this link can join{hasPin ? ' if they also have the code' : ''}.
        </p>

        <div className="invite-link-box">
          <span className="invite-link-text">{link}</span>
          <button className="icon-btn" onClick={copyLink} title="Copy link">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div className="invite-actions">
          <button className="btn-secondary" onClick={shareOnWhatsApp}>Share on WhatsApp</button>
          <button className="btn-link" onClick={rotateLink} disabled={busy}>
            <RefreshCw size={13} /> New link
          </button>
        </div>

        <form onSubmit={savePin} className="stack invite-pin-section">
          <label>
            Require a 4-digit code {hasPin && <span className="chip-tag">on</span>}
          </label>
          <p className="hint small">
            Extra safety if the link gets forwarded around. Send the code separately —
            over a different chat, or just tell people in person.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={hasPin ? 'Enter a new code' : 'e.g. 4821'}
            className="pin-input"
          />
          <button type="submit" className="btn-secondary" disabled={busy}>
            {pin ? 'Set code' : hasPin ? 'Remove code' : 'Save'}
          </button>
        </form>

        {status && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}

        <div className="modal-actions mt">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
