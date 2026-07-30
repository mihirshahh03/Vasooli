import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Archive, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function GroupMenu({ group, isAdmin, onArchiveToggled, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function toggleArchive() {
    setOpen(false)
    const { error } = await supabase
      .from('groups')
      .update({ archived_at: group.archived_at ? null : new Date().toISOString() })
      .eq('id', group.id)
    if (error) return alert(error.message)
    onArchiveToggled?.()
  }

  async function confirmDelete() {
    setBusy(true)
    const { error } = await supabase.from('groups').delete().eq('id', group.id)
    setBusy(false)
    if (error) return alert(error.message)
    onDeleted?.()
  }

  return (
    <div className="group-menu-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((s) => !s)}><MoreVertical size={20} /></button>
      {open && (
        <div className="dropdown-menu">
          <button onClick={toggleArchive}>
            <Archive size={16} /> {group.archived_at ? 'Unarchive' : 'Archive'} group
          </button>
          {isAdmin && (
            <button className="danger" onClick={() => { setOpen(false); setConfirmingDelete(true) }}>
              <Trash2 size={16} /> Delete group
            </button>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmingDelete(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete "{group.name}"?</h3>
            <p className="modal-body">
              This permanently deletes every expense, comment, and settlement in this group, for everyone.
              This can't be undone. Type the group name to confirm.
            </p>
            <input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={group.name}
              autoCapitalize="none"
            />
            <div className="modal-actions mt">
              <button className="btn-link" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button
                className="btn-primary btn-danger"
                disabled={typedName !== group.name || busy}
                onClick={confirmDelete}
              >
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
