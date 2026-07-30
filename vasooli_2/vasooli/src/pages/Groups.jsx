import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import ProfileSettings from '../components/ProfileSettings'

const EMOJI_CHOICES = ['🧾', '🏖️', '🏔️', '🎉', '🍷', '🏕️', '🚗', '🏠', '✈️', '🍔']

export default function Groups({ profile, onOpenGroup, onLogout, onProfileUpdated }) {
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState(EMOJI_CHOICES[0])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  async function loadGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, emoji, archived_at, created_at')
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
      .insert({ name: newName.trim(), emoji: newEmoji, created_by: profile.id })
    setCreating(false)
    if (error) return setError(error.message)
    setNewName('')
    loadGroups()
  }

  async function toggleArchive(group, e) {
    e.stopPropagation()
    const { error } = await supabase
      .from('groups')
      .update({ archived_at: group.archived_at ? null : new Date().toISOString() })
      .eq('id', group.id)
    if (error) return alert(error.message)
    loadGroups()
  }

  const visibleGroups = groups.filter((g) => (showArchived ? true : !g.archived_at))

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-small">Vasooli</span>
        <div className="topbar-right">
          <button className="btn-link" onClick={() => setShowSettings(true)}>@{profile.username}</button>
          <button className="btn-link" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="content">
        <h2>Your groups</h2>

        <form onSubmit={createGroup} className="stack">
          <div className="emoji-picker">
            {EMOJI_CHOICES.map((em) => (
              <button
                type="button"
                key={em}
                className={`emoji-choice ${newEmoji === em ? 'active' : ''}`}
                onClick={() => setNewEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>
          <div className="inline-form">
            <input
              placeholder="New group, e.g. Nashik Trip"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? '…' : 'Create'}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <div className="stack-list mt">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : visibleGroups.length === 0 ? (
          <p className="hint mt">
            {showArchived ? 'No archived groups.' : "No groups yet. Create one above, then add your friends by username."}
          </p>
        ) : (
          <div className="stack-list">
            {visibleGroups.map((g) => (
              <button key={g.id} className="row-card" onClick={() => onOpenGroup(g)}>
                <span className="row-card-left">
                  <span className="group-emoji">{g.emoji || '🧾'}</span>
                  <span>{g.name}</span>
                  {g.archived_at && <span className="chip-tag">archived</span>}
                </span>
                <span className="row-card-right">
                  <span className="btn-link small-link" onClick={(e) => toggleArchive(g, e)}>
                    {g.archived_at ? 'Unarchive' : 'Archive'}
                  </span>
                  <span className="arrow">→</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <button className="btn-link mt" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Hide archived groups' : 'Show archived groups'}
        </button>
      </div>

      {showSettings && (
        <ProfileSettings
          profile={profile}
          onClose={() => setShowSettings(false)}
          onSaved={() => { onProfileUpdated?.(); }}
        />
      )}
    </div>
  )
}
