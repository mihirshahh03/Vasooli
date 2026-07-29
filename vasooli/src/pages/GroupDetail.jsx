import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Members from '../components/Members'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import Tables from '../components/Tables'

export default function GroupDetail({ group, profile, onBack }) {
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [shares, setShares] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expenses') // 'expenses' | 'summary'

  async function loadAll() {
    setLoading(true)

    const { data: memberRows } = await supabase
      .from('group_members')
      .select('role, profiles(id, username, display_name)')
      .eq('group_id', group.id)

    const memberProfiles = (memberRows || [])
      .filter((r) => r.profiles)
      .map((r) => ({ ...r.profiles, role: r.role }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name))

    const { data: expenseRows } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at')

    let shareRows = []
    const ids = (expenseRows || []).map((e) => e.id)
    if (ids.length > 0) {
      const { data } = await supabase.from('expense_shares').select('*').in('expense_id', ids)
      shareRows = data || []
    }

    setMembers(memberProfiles)
    setExpenses(expenseRows || [])
    setShares(shareRows)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [group.id])

  return (
    <div className="screen">
      <header className="topbar">
        <button className="btn-link" onClick={onBack}>← Groups</button>
        <span className="hello">{group.name}</span>
      </header>

      <div className="content">
        <Members group={group} members={members} myId={profile.id} onChanged={loadAll} />

        <div className="tab-row">
          <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
            Expenses
          </button>
          <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
            Summary
          </button>
        </div>

        {tab === 'expenses' && (
          <>
            {!showForm && (
              <button className="btn-primary full" onClick={() => setShowForm(true)}>
                + Add expense
              </button>
            )}
            {showForm && (
              members.length === 0 ? (
                <p className="hint">Add at least one member before logging expenses.</p>
              ) : (
                <ExpenseForm
                  group={group}
                  members={members}
                  profile={profile}
                  onCancel={() => setShowForm(false)}
                  onSaved={() => { setShowForm(false); loadAll() }}
                />
              )
            )}
            {loading ? (
              <p className="hint">Loading…</p>
            ) : (
              <ExpenseList expenses={expenses} members={members} onChanged={loadAll} />
            )}
          </>
        )}

        {tab === 'summary' && (
          loading ? (
            <p className="hint">Loading…</p>
          ) : (
            <Tables expenses={expenses} shares={shares} profiles={members} />
          )
        )}
      </div>
    </div>
  )
}
