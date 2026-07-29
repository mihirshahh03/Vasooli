import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Members({ group, members, myId, onChanged }) {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState(null) // { type: 'error' | 'ok', text }
  const [busy, setBusy] = useState(false)

  const myRole = members.find((m) => m.id === myId)?.role

  async function addMember(e) {
    e.preventDefault()
    const uname = username.trim().toLowerCase()
    if (!uname) return

    setBusy(true)
    setStatus(null)

    const { data: found, error } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', uname)
      .maybeSingle()

    if (error) {
      setBusy(false)
      return setStatus({ type: 'error', text: error.message })
    }
    if (!found) {
      setBusy(false)
      return setStatus({
        type: 'error',
        text: `No account with the username "${uname}". Check the spelling, or ask them to sign up first.`,
      })
    }
    if (members.some((m) => m.id === found.id)) {
      setBusy(false)
      return setStatus({ type: 'error', text: `${found.display_name} is already in this group.` })
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, profile_id: found.id, role: 'member' })

    setBusy(false)
    if (insertError) return setStatus({ type: 'error', text: insertError.message })

    setUsername('')
    setStatus({ type: 'ok', text: `Added ${found.display_name}.` })
    onChanged()
  }

  async function removeMember(m) {
    const isSelf = m.id === myId
    const label = isSelf ? 'Leave this group?' : `Remove ${m.display_name} from the group?`
    if (!confirm(label)) return

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('profile_id', m.id)

    if (error) return setStatus({ type: 'error', text: error.message })
    onChanged()
  }

  return (
    <div className="panel">
      <h3>Members</h3>

      <div className="chip-row">
        {members.map((m) => (
          <span key={m.id} className="chip">
            {m.display_name}
            {m.role === 'admin' && <span className="chip-tag">admin</span>}
            {(myRole === 'admin' || m.id === myId) && (
              <button
                className="chip-x"
                onClick={() => removeMember(m)}
                title={m.id === myId ? 'Leave group' : 'Remove'}
                type="button"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      <form onSubmit={addMember} className="inline-form">
        <input
          placeholder="Add by username, e.g. bhaijaan"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? '…' : 'Add'}
        </button>
      </form>

      {status && (
        <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>
      )}
    </div>
  )
}
