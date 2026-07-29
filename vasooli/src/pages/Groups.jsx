import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Groups({ profile, onOpenGroup, onLogout }) {
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setGroups(data || [])
    setLoading(false)
  }

  useEffect(() => { loadGroups() }, [])

  async function createGroup(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    const { error } = await supabase
      .from('groups')
      .insert({ name: newName.trim(), created_by: profile.id })
    setCreating(false)
    if (error) return setError(error.message)
    setNewName('')
    loadGroups()
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-small">Vasooli</span>
        <div className="topbar-right">
          <span className="hello">@{profile.username}</span>
          <button className="btn-link" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="content">
        <h2>Your groups</h2>

        <form onSubmit={createGroup} className="inline-form">
          <input
            placeholder="New group, e.g. Nashik Trip"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? '…' : 'Create'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="hint">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="hint">
            No groups yet. Create one above, then add your friends by their username.
          </p>
        ) : (
          <div className="stack-list">
            {groups.map((g) => (
              <button key={g.id} className="row-card" onClick={() => onOpenGroup(g)}>
                <span>{g.name}</span>
                <span className="arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
