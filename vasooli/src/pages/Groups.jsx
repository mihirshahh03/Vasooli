import { useEffect, useRef, useState } from 'react'
import { User, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'

const EMOJI_CHOICES = ['🧾', '🏖️', '🏔️', '🎉', '🍷', '🏕️', '🚗', '🏠', '✈️', '🍔']

export default function Groups({ profile, onOpenGroup, onOpenProfile }) {
  const [groups, setGroups] = useState([])
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState(EMOJI_CHOICES[0])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isInternational, setIsInternational] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, emoji, archived_at, is_international, start_date, end_date, created_at')
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
    const { error } = await supabase.from('groups').insert({
      name: newName.trim(),
      emoji: newEmoji,
      created_by: profile.id,
      is_international: isInternational,
      start_date: startDate || null,
      end_date: endDate || null,
    })
    setCreating(false)
    if (error) return setError(error.message)
    setNewName('')
    setStartDate('')
    setEndDate('')
    loadGroups()
  }

  const visibleGroups = groups.filter((g) => (showArchived ? true : !g.archived_at))

  function formatDates(g) {
    if (!g.start_date) return null
    const opts = { day: 'numeric', month: 'short' }
    const start = new Date(g.start_date).toLocaleDateString('en-IN', opts)
    const end = g.end_date ? new Date(g.end_date).toLocaleDateString('en-IN', opts) : null
    return end ? `${start} – ${end}` : start
  }

  return (
    <div className="screen">
      <header className="topbar">
        <span className="brand-small">Vasooli</span>
        <button className="icon-btn" onClick={onOpenProfile} title="Profile">
          <User size={20} />
        </button>
      </header>

      <div className="content">
        <h2>Your groups</h2>

        <form onSubmit={createGroup} className="create-group-form">
          <div className="create-group-row">
            <div className="emoji-popover-wrap" ref={pickerRef}>
              <button
                type="button"
                className="emoji-trigger"
                onClick={() => setShowEmojiPicker((s) => !s)}
              >
                {newEmoji}
              </button>
              {showEmojiPicker && (
                <div className="emoji-popover">
                  {EMOJI_CHOICES.map((em) => (
                    <button
                      type="button"
                      key={em}
                      className="emoji-choice"
                      onClick={() => { setNewEmoji(em); setShowEmojiPicker(false) }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              placeholder="New group, e.g. Nashik Trip"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className="trip-type-toggle">
            <button type="button" className={!isInternational ? 'active' : ''} onClick={() => setIsInternational(false)}>
              Domestic
            </button>
            <button type="button" className={isInternational ? 'active' : ''} onClick={() => setIsInternational(true)}>
              International
            </button>
          </div>

          <div className="date-row">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="faint">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <button type="submit" className="btn-primary full" disabled={creating}>
            {creating ? 'Creating…' : 'Create group'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <div className="stack-list mt">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : visibleGroups.length === 0 ? (
          <p className="hint mt">
            {showArchived ? 'No archived groups.' : 'No groups yet. Create one above, then add your friends by username.'}
          </p>
        ) : (
          <div className="stack-list">
            {visibleGroups.map((g) => (
              <button key={g.id} className="row-card" onClick={() => onOpenGroup(g)}>
                <span className="row-card-left">
                  <span className="group-emoji">{g.emoji || '🧾'}</span>
                  <span className="group-card-text">
                    <span>{g.name}</span>
                    {formatDates(g) && <span className="group-dates">{formatDates(g)}</span>}
                  </span>
                  {g.archived_at && <span className="chip-tag">archived</span>}
                  {g.is_international && <span className="chip-tag">intl</span>}
                </span>
                <ChevronRight size={18} className="arrow" />
              </button>
            ))}
          </div>
        )}

        <button className="btn-link mt" onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Hide archived groups' : 'Show archived groups'}
        </button>
      </div>
    </div>
  )
}
