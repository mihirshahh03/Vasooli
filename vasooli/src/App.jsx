import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
      if (!s) {
        setProfile(null)
        setOpenGroup(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, username, display_name, email, upi_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setProfile(data)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [session])

  async function logout() {
    await supabase.auth.signOut()
  }

  function refreshProfile() {
    if (!session) return
    supabase
      .from('profiles')
      .select('id, username, display_name, email, upi_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }

  if (recovering) {
    return <ResetPassword onDone={() => setRecovering(false)} />
  }
  if (loading) return <div className="screen center"><p className="hint">Loading…</p></div>
  if (!session || !profile) return <Auth />
  if (openGroup) {
    return (
      <GroupDetail
        group={openGroup}
        profile={profile}
        onBack={() => setOpenGroup(null)}
      />
    )
  }
  return (
    <Groups
      profile={profile}
      onOpenGroup={setOpenGroup}
      onLogout={logout}
      onProfileUpdated={refreshProfile}
    />
  )
}
