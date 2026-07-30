import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../supabaseClient'
import Members from '../components/Members'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import Tables from '../components/Tables'
import Activity from '../components/Activity'
import BottomNav from '../components/BottomNav'
import GroupMenu from '../components/GroupMenu'

export default function GroupDetail({ group, profile, onBack, onDeleted }) {
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [shares, setShares] = useState([])
  const [settlements, setSettlements] = useState([])
  const [activity, setActivity] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expenses')
  const [groupInfo, setGroupInfo] = useState(group)

  async function loadAll() {
    setLoading(true)

    const { data: freshGroup } = await supabase.from('groups').select('*').eq('id', group.id).single()
    if (freshGroup) setGroupInfo(freshGroup)

    const { data: memberRows } = await supabase
      .from('group_members')
      .select('role, profiles(id, username, display_name, upi_id)')
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

    const { data: settlementRows } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', group.id)

    const { data: activityRows } = await supabase
      .from('activity_log')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setMembers(memberProfiles)
    setExpenses(expenseRows || [])
    setShares(shareRows)
    setSettlements(settlementRows || [])
    setActivity(activityRows || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [group.id])

  const myRole = members.find((m) => m.id === profile.id)?.role
  const sharesForExpense = (expenseId) => shares.filter((s) => s.expense_id === expenseId)

  function formatDates() {
    if (!groupInfo.start_date) return null
    const opts = { day: 'numeric', month: 'short' }
    const start = new Date(groupInfo.start_date).toLocaleDateString('en-IN', opts)
    const end = groupInfo.end_date ? new Date(groupInfo.end_date).toLocaleDateString('en-IN', opts) : null
    return end ? `${start} – ${end}` : start
  }

  return (
    <div className="screen with-bottom-nav">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <span className="hello group-header-title">
          <span>{groupInfo.emoji} {groupInfo.name}</span>
          {formatDates() && <span className="group-dates">{formatDates()}</span>}
        </span>
        <GroupMenu
          group={groupInfo}
          isAdmin={myRole === 'admin'}
          onArchiveToggled={loadAll}
          onDeleted={onDeleted}
        />
      </header>

      <div className="content">
        <Members group={group} members={members} myId={profile.id} onChanged={loadAll} />

        {tab === 'expenses' && (
          <>
            {!showForm && !editingExpense && (
              <button className="btn-primary full" onClick={() => setShowForm(true)}>
                + Add expense
              </button>
            )}
            {(showForm || editingExpense) && (
              members.length === 0 ? (
                <p className="hint">Add at least one member before logging expenses.</p>
              ) : (
                <ExpenseForm
                  group={groupInfo}
                  members={members}
                  profile={profile}
                  existingExpense={editingExpense}
                  existingShares={editingExpense ? sharesForExpense(editingExpense.id) : null}
                  onCancel={() => { setShowForm(false); setEditingExpense(null) }}
                  onSaved={() => { setShowForm(false); setEditingExpense(null); loadAll() }}
                />
              )
            )}
            {loading ? (
              <div className="stack-list mt">
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </div>
            ) : (
              <ExpenseList
                expenses={expenses}
                members={members}
                profile={profile}
                myRole={myRole}
                onEdit={(exp) => { setShowForm(false); setEditingExpense(exp) }}
                onChanged={loadAll}
              />
            )}
          </>
        )}

        {tab === 'activity' && <Activity items={activity} loading={loading} />}

        {tab === 'summary' && (
          loading ? (
            <div className="stack-list mt">
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </div>
          ) : (
            <Tables
              group={groupInfo}
              expenses={expenses}
              shares={shares}
              settlements={settlements}
              profiles={members}
              myId={profile.id}
              onChanged={loadAll}
            />
          )
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
